//! `@path` imports, and what each agent loads from an instruction file: pure, no I/O.
//!
//! Claude Code (memory docs, "Import additional files"): `@path` imports another file,
//! relative to the importing file, up to four hops; imports in code spans and fenced code
//! blocks are skipped, a quoted path is not imported, and `\ ` escapes a space. Block-level
//! HTML comments are stripped before injection. `OpenCode` 2 (`instruction-discovery.ts`)
//! injects an `AGENTS.md` verbatim: no import expansion, no comment stripping.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use vitals_utils::TextSize;
use vitals_utils::markdown::{self, outside_code, prose};

/// How many hops of imports Claude Code follows.
pub const HOPS: usize = 4;

/// Imported files read by the snapshot: the content, or `None` when no file is there.
pub(crate) type Imported = BTreeMap<PathBuf, Option<String>>;

/// One `@path` token, as written, and its line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Import {
    pub(crate) line: usize,
    pub(crate) raw: String,
    /// A bare word (`@README`): an import only when a file is there, since `@team` is more
    /// often a mention, so a missing target is not reported.
    pub(crate) bare: bool,
}

/// Every import in `text`, in file order.
pub(crate) fn tokens(text: &str) -> Vec<Import> {
    prose(text)
        .flat_map(|line| {
            outside_code(line.text)
                .flat_map(in_part)
                .map(move |(raw, bare)| Import {
                    line: line.number,
                    raw,
                    bare,
                })
        })
        .collect()
}

/// The imports in a stretch of prose: an `@` at its start or after whitespace.
fn in_part(part: &str) -> Vec<(String, bool)> {
    let previous = core::iter::once(' ').chain(part.chars());
    part.char_indices()
        .zip(previous)
        .filter(|((_, current), before)| *current == '@' && before.is_whitespace())
        .filter_map(|((at, _), _)| part.get(at..).and_then(|rest| rest.strip_prefix('@')))
        .filter_map(path_at)
        .collect()
}

/// The path that opens `rest`, up to the first whitespace not escaped by `\`, and whether
/// it is a bare word (`@README`, the memory docs' own example); `None` for a quoted path
/// or a token that is neither a path nor a word (`@team:`).
fn path_at(rest: &str) -> Option<(String, bool)> {
    let previous = core::iter::once('\0').chain(rest.chars());
    let end = rest
        .char_indices()
        .zip(previous)
        .find(|((_, current), before)| current.is_whitespace() && *before != '\\')
        .map_or(rest.len(), |((at, _), _)| at);
    let raw = rest.get(..end)?.replace("\\ ", " ");
    let quoted = raw.starts_with(['"', '\'']);
    if raw.is_empty() || quoted {
        return None;
    }
    // A bare word ends at sentence punctuation: `@README,`, `@team.`.
    let word = raw.trim_end_matches([',', ';', ':', '!', '?', ')', '.']);
    if word.contains(['/', '.']) || raw.starts_with('~') {
        return Some((raw, false));
    }
    let bare = !word.is_empty()
        && word
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_');
    bare.then(|| (word.to_owned(), true))
}

/// Where an import points.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Target {
    /// A path inside the repository, relative to its root.
    Repository(PathBuf),
    /// The home directory, an absolute path, or a path that climbs out of the repository.
    External,
}

/// Where `raw`, imported from the file at `from` (relative to the root), points.
pub(crate) fn target(from: &Path, raw: &str) -> Target {
    if raw.starts_with('~') || Path::new(raw).is_absolute() {
        return Target::External;
    }
    let dir = from.parent().unwrap_or_else(|| Path::new(""));
    markdown::resolve(dir, raw).map_or(Target::External, Target::Repository)
}

/// The imports of `text`, in the file at `from`, that point inside the repository, with
/// their targets.
pub(crate) fn repository_targets(from: &Path, text: &str) -> Vec<(Import, PathBuf)> {
    tokens(text)
        .into_iter()
        .filter_map(|import| match target(from, &import.raw) {
            Target::Repository(path) => Some((import, path)),
            Target::External => None,
        })
        .collect()
}

/// Why an import loads nothing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Problem {
    /// No file at the target.
    Missing,
    /// The import is past [`HOPS`]: Claude Code does not follow it.
    TooDeep,
}

/// An import that loads nothing, in the file that holds it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Broken {
    pub(crate) file: PathBuf,
    pub(crate) import: Import,
    pub(crate) problem: Problem,
}

/// What Claude Code loads from one instruction file: the file without its block comments,
/// then every file it imports, as far as [`HOPS`].
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct Expansion {
    pub(crate) text: String,
    /// The files loaded through imports, in load order.
    pub(crate) loaded: Vec<PathBuf>,
    pub(crate) broken: Vec<Broken>,
}

/// Expands the file at `path`, holding `text`, with the files in `imported`.
pub(crate) fn expand(path: &Path, text: &str, imported: &Imported) -> Expansion {
    let mut walk = Walk {
        imported,
        seen: BTreeSet::from([path.to_path_buf()]),
        expansion: Expansion::default(),
    };
    walk.visit(path, text, 0);
    walk.expansion
}

/// The state of one expansion.
struct Walk<'a> {
    imported: &'a Imported,
    seen: BTreeSet<PathBuf>,
    expansion: Expansion,
}

impl Walk<'_> {
    fn visit(&mut self, path: &Path, text: &str, depth: usize) {
        append(&mut self.expansion.text, &markdown::without_comments(text));
        let hop = depth.saturating_add(1);
        for (import, target) in repository_targets(path, text) {
            let problem = self
                .follow(&target, hop)
                .filter(|problem| !(import.bare && *problem == Problem::Missing));
            self.expansion.broken.extend(problem.map(|problem| Broken {
                file: path.to_path_buf(),
                import,
                problem,
            }));
        }
    }

    /// Loads `target` at `hop`, or says why it loads nothing.
    fn follow(&mut self, target: &Path, hop: usize) -> Option<Problem> {
        let imported = self.imported;
        let Some(Some(content)) = imported.get(target) else {
            return Some(Problem::Missing);
        };
        if hop > HOPS {
            return Some(Problem::TooDeep);
        }
        if self.seen.insert(target.to_path_buf()) {
            self.expansion.loaded.push(target.to_path_buf());
            self.visit(target, content, hop);
        }
        None
    }
}

/// Appends `part` to `text` on its own lines.
fn append(text: &mut String, part: &str) {
    if !text.is_empty() && !text.ends_with('\n') {
        text.push('\n');
    }
    text.push_str(part);
}

/// The size of an instruction file as each agent loads it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Load {
    /// Claude Code: comments stripped, imports expanded.
    pub(crate) claude: TextSize,
    /// `OpenCode` 2: the file verbatim, when it reads the file (an `AGENTS.md`).
    pub(crate) opencode: Option<TextSize>,
    /// How many files the imports added.
    pub(crate) imports: usize,
}

impl Load {
    /// The size of `text` at `path`, as loaded by each agent.
    pub(crate) fn of(path: &Path, text: &str, imported: &Imported, opencode_reads: bool) -> Self {
        let expansion = expand(path, text, imported);
        Self {
            claude: TextSize::of(&expansion.text),
            opencode: opencode_reads.then(|| TextSize::of(text)),
            imports: expansion.loaded.len(),
        }
    }

    /// The larger of the two views, by `measure`, and what makes it differ from the file.
    pub(crate) fn larger(&self, measure: fn(&TextSize) -> usize) -> (usize, Option<String>) {
        let claude = measure(&self.claude);
        let opencode = self.opencode.as_ref().map_or(0, measure);
        if opencode > claude {
            (
                opencode,
                Some("as OpenCode loads it, HTML comments included".to_owned()),
            )
        } else if self.imports > 0 {
            (claude, Some(imported_note(self.imports)))
        } else {
            (claude, None)
        }
    }
}

fn imported_note(count: usize) -> String {
    let files = if count == 1 { "file" } else { "files" };
    format!("as Claude Code loads it, with {count} imported {files}")
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{Broken, Imported, Load, Problem, Target, expand, target, tokens};
    use std::path::{Path, PathBuf};
    use vitals_utils::TextSize;

    fn raws(text: &str) -> Vec<String> {
        tokens(text).into_iter().map(|import| import.raw).collect()
    }

    fn imported(files: &[(&str, Option<&str>)]) -> Imported {
        files
            .iter()
            .map(|(path, content)| (PathBuf::from(path), content.map(str::to_owned)))
            .collect()
    }

    #[test]
    fn tokens_follow_the_documented_syntax() {
        assert_eq!(
            raws("@AGENTS.md\nSee @docs/style.md and @~/.claude/me.md.\n"),
            ["AGENTS.md", "docs/style.md", "~/.claude/me.md."]
        );
        assert_eq!(raws("@Design\\ Docs/spec.md here"), ["Design Docs/spec.md"]);
        assert_eq!(raws("\"@quoted.md\" @\"quoted.md\""), Vec::<String>::new());
        assert_eq!(
            raws("`@README.md` user@host @team's x\n```\n- @code.md\n```\n"),
            Vec::<String>::new()
        );
        let bare: Vec<(String, bool)> = tokens("See @README and @docs/a.md\n")
            .into_iter()
            .map(|import| (import.raw, import.bare))
            .collect();
        assert_eq!(
            bare,
            [("README".to_owned(), true), ("docs/a.md".to_owned(), false)]
        );
        let lines: Vec<usize> = tokens("a\n\n- @b.md\n").iter().map(|i| i.line).collect();
        assert_eq!(lines, [3]);
    }

    #[test]
    fn targets_resolve_from_the_importing_file() {
        let dot = Path::new(".claude/CLAUDE.md");
        assert_eq!(
            target(dot, "../AGENTS.md"),
            Target::Repository(PathBuf::from("AGENTS.md"))
        );
        assert_eq!(
            target(Path::new("AGENTS.md"), "./docs/a.md"),
            Target::Repository(PathBuf::from("docs/a.md"))
        );
        assert_eq!(target(Path::new("AGENTS.md"), "~/x.md"), Target::External);
        assert_eq!(
            target(Path::new("AGENTS.md"), "/etc/x.md"),
            Target::External
        );
        assert_eq!(target(Path::new("AGENTS.md"), "../x.md"), Target::External);
    }

    #[test]
    fn expansion_strips_comments_follows_four_hops_and_reports_the_rest() {
        let files = imported(&[
            ("h1.md", Some("one\n- @h2.md\n")),
            ("h2.md", Some("two\n- @h3.md\n")),
            ("h3.md", Some("three\n- @h4.md\n")),
            ("h4.md", Some("four\n- @h5.md\n")),
            ("h5.md", Some("five\n")),
            ("gone.md", None),
        ]);
        let text = "<!-- note -->\nroot\n- @h1.md\n- @gone.md\n- @absent.md\n- @~/me.md\n";
        let found = expand(Path::new("AGENTS.md"), text, &files);
        assert_eq!(found.loaded.len(), 4);
        assert!(found.text.starts_with("root\n"));
        assert!(found.text.contains("four") && !found.text.contains("five"));
        assert!(!found.text.contains("note"));
        let broken: Vec<(String, Problem)> = found
            .broken
            .iter()
            .map(|b| (b.import.raw.clone(), b.problem))
            .collect();
        assert_eq!(
            broken,
            [
                ("h5.md".to_owned(), Problem::TooDeep),
                ("gone.md".to_owned(), Problem::Missing),
                ("absent.md".to_owned(), Problem::Missing),
            ]
        );
        assert_eq!(found.broken.first().unwrap().file, Path::new("h4.md"));
    }

    #[test]
    fn a_bare_word_imports_a_file_that_exists_and_is_otherwise_a_mention() {
        let files = imported(&[("README", Some("# Readme\n")), ("team", None)]);
        let found = expand(Path::new("AGENTS.md"), "See @README, ask @team\n", &files);
        assert_eq!(found.loaded, [PathBuf::from("README")]);
        assert!(found.text.contains("# Readme"));
        assert_eq!(found.broken, Vec::<Broken>::new());
    }

    #[test]
    fn cycles_load_each_file_once() {
        let files = imported(&[("a.md", Some("@b.md\n")), ("b.md", Some("x\n- @a.md\n"))]);
        let found = expand(Path::new("AGENTS.md"), "@a.md\n- @a.md", &files);
        assert_eq!(found.loaded, [PathBuf::from("a.md"), PathBuf::from("b.md")]);
        assert_eq!(found.broken, Vec::<Broken>::new());
    }

    #[test]
    fn load_reports_the_larger_view() {
        let files = imported(&[("docs/a.md", Some("a\nb\nc\n"))]);
        let with_import = Load::of(Path::new("AGENTS.md"), "x\n- @docs/a.md\n", &files, true);
        assert_eq!(
            with_import.larger(TextSize::lines),
            (
                5,
                Some("as Claude Code loads it, with 1 imported file".to_owned())
            )
        );
        let commented = Load::of(Path::new("AGENTS.md"), "x\n<!--\nlong\n-->\n", &files, true);
        assert_eq!(
            commented.larger(TextSize::lines),
            (
                4,
                Some("as OpenCode loads it, HTML comments included".to_owned())
            )
        );
        let claude_only = Load::of(
            Path::new("CLAUDE.md"),
            "x\n<!--\nlong\n-->\n",
            &files,
            false,
        );
        assert_eq!(claude_only.larger(TextSize::lines), (1, None));
        let two = imported(&[("a.md", Some("a\n")), ("b.md", Some("b\n"))]);
        let plural = Load::of(Path::new("AGENTS.md"), "@a.md\n- @b.md\n", &two, false);
        assert!(
            plural
                .larger(TextSize::chars)
                .1
                .unwrap()
                .ends_with("2 imported files")
        );
    }
}
