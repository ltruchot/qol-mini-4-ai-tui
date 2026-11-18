//! Probes `AM16`–`AM19`: what the instruction files say, by syntax alone (ADR 4, "Content
//! probes"). Pure functions of a [`Snapshot`].
//!
//! They judge every file an agent reads as instructions: the root rules file, the nested
//! instruction files, and the files they import.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use vitals_utils::markdown::{self, Region, code_spans, outside_code, prose};
use vitals_utils::{Finding, Verdict, or_pass};

use crate::cascade::{Kind, classify};
use crate::imports::{self, Broken, HOPS, Problem};
use crate::opencode;
use crate::snapshot::Snapshot;

/// The longest block (paragraph, list item, table row) before `AM17` warns, in chars.
pub const BLOCK_CHARS: usize = 400;

/// The length from which a file needs headings, in lines.
pub const HEADING_FLOOR: usize = 30;

/// How many emphasis markers a file can spend before `AM18` warns.
pub const EMPHASIS_BUDGET: usize = 3;

/// Emphasis words, matched in capitals only.
const EMPHASIS_WORDS: [&str; 12] = [
    "IMPORTANT",
    "MUST",
    "NEVER",
    "ALWAYS",
    "CRITICAL",
    "MANDATORY",
    "REQUIRED",
    "JAMAIS",
    "TOUJOURS",
    "OBLIGATOIRE",
    "IMPÉRATIF",
    "INTERDIT",
];

/// How many locations a finding lists before it counts the rest.
const SHOWN: usize = 5;

/// A file the content probes judge.
pub(crate) struct Judged<'a> {
    pub(crate) path: PathBuf,
    pub(crate) text: &'a str,
}

/// Every file an agent reads as instructions: the import sources (the root rules files and
/// the nested files an agent reads), then the Markdown files that Claude Code loads through
/// their imports, within four hops. An imported file that is not Markdown
/// (`@package.json`) counts in the budgets but is not prose to judge.
pub(crate) fn judged(snapshot: &Snapshot) -> Vec<Judged<'_>> {
    let sources = import_sources(snapshot);
    let mut files: Vec<Judged<'_>> = sources
        .iter()
        .map(|(path, text)| Judged {
            path: path.clone(),
            text,
        })
        .collect();
    let loaded = sources
        .iter()
        .flat_map(|(path, text)| imports::expand(path, text, &snapshot.imported).loaded);
    for path in loaded {
        let text = snapshot.imported.get(&path).and_then(Option::as_deref);
        let fresh = files.iter().all(|file| file.path != path);
        if let Some(text) = text.filter(|_| fresh && is_markdown(&path)) {
            files.push(Judged { path, text });
        }
    }
    files
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            ["md", "markdown", "mdx"]
                .iter()
                .any(|known| extension.eq_ignore_ascii_case(known))
        })
}

pub(crate) fn findings(snapshot: &Snapshot) -> Vec<Finding> {
    let files = judged(snapshot);
    [
        import_findings(snapshot),
        each("AM17", &files, structure, "headings and short blocks"),
        each("AM18", &files, emphasis, "emphasis within budget"),
        references(snapshot, &files),
    ]
    .concat()
}

/// Runs `probe` on every file; a pass naming `what` when nothing is found.
fn each(
    id: &'static str,
    files: &[Judged<'_>],
    probe: fn(&Judged<'_>) -> Vec<Finding>,
    what: &str,
) -> Vec<Finding> {
    if files.is_empty() {
        return vec![Finding::new(
            id,
            Verdict::NotApplicable,
            ".",
            "no instruction file to judge",
        )];
    }
    let found = files.iter().flat_map(probe).collect();
    let noun = if files.len() == 1 { "file" } else { "files" };
    let pass = format!("{} instruction {noun}: {what}", files.len());
    or_pass(found, Finding::new(id, Verdict::Pass, ".", pass))
}

/// `"lines 3, 8, 12"`, with at most [`SHOWN`] numbers.
fn lines_list(numbers: &[usize]) -> String {
    let shown: Vec<String> = numbers.iter().take(SHOWN).map(usize::to_string).collect();
    let more = numbers.len().saturating_sub(SHOWN);
    let tail = if more > 0 {
        format!(" and {more} more")
    } else {
        String::new()
    };
    let word = if numbers.len() == 1 { "line" } else { "lines" };
    format!("{word} {}{tail}", shown.join(", "))
}

// ---------------------------------------------------------------- AM16: imports

/// `AM16`: every `@path` import loads a file, within four hops, for both agents.
fn import_findings(snapshot: &Snapshot) -> Vec<Finding> {
    let sources = import_sources(snapshot);
    let any = sources
        .iter()
        .any(|(_, text)| !imports::tokens(text).is_empty());
    if !any {
        return vec![Finding::new(
            "AM16",
            Verdict::NotApplicable,
            ".",
            "no @path import",
        )];
    }
    let mut seen = BTreeSet::new();
    let found: Vec<Finding> = sources
        .iter()
        .flat_map(|(path, text)| source_findings(path, text, snapshot, &mut seen))
        .collect();
    or_pass(
        found,
        Finding::new(
            "AM16",
            Verdict::Pass,
            ".",
            "every @path import loads a file",
        ),
    )
}

/// An import broken somewhere: the file, the line, and the token.
type Seen = BTreeSet<(PathBuf, usize, String)>;

/// The `AM16` findings of one source. A file that two sources load (`CLAUDE.md` bridging
/// to `AGENTS.md`) is reported once, through `seen`.
fn source_findings(path: &Path, text: &str, snapshot: &Snapshot, seen: &mut Seen) -> Vec<Finding> {
    imports::expand(path, text, &snapshot.imported)
        .broken
        .into_iter()
        .filter(|found| {
            seen.insert((
                found.file.clone(),
                found.import.line,
                found.import.raw.clone(),
            ))
        })
        .map(|found| broken(&found))
        .chain(unseen_by_opencode(path, text, snapshot))
        .collect()
}

/// The files whose imports are followed: the root files with content, then the nested
/// instruction files.
fn import_sources(snapshot: &Snapshot) -> Vec<(PathBuf, &str)> {
    let root = [
        ("AGENTS.md", snapshot.agents_md.as_deref()),
        ("CLAUDE.md", snapshot.claude_md.content.as_deref()),
        (
            ".claude/CLAUDE.md",
            snapshot.dot_claude_md.content.as_deref(),
        ),
    ]
    .into_iter()
    .filter_map(|(path, text)| Some((PathBuf::from(path), text?)))
    // A `CLAUDE.md` that links to `AGENTS.md` is the same file.
    .filter(|(path, text)| path == Path::new("AGENTS.md") || snapshot.agents_md.as_deref() != Some(*text));
    let nested = snapshot
        .nested
        .iter()
        .filter(|entry| classify(&entry.path) != Some(Kind::Unread))
        .filter_map(|entry| Some((entry.path.clone(), entry.file.content.as_deref()?)));
    root.chain(nested).collect()
}

fn broken(found: &Broken) -> Finding {
    let raw = &found.import.raw;
    let at = format!("line {}", found.import.line);
    match found.problem {
        Problem::Missing => Finding::new(
            "AM16",
            Verdict::Warn,
            &found.file,
            format!("{at}: `@{raw}` imports nothing: no file is there"),
        )
        .with_fix("fix the path (relative to the importing file) or remove the import"),
        Problem::TooDeep => Finding::new(
            "AM16",
            Verdict::Warn,
            &found.file,
            format!("{at}: `@{raw}` is past {HOPS} hops of imports: Claude Code does not load it"),
        )
        .with_fix("import that file from a file closer to the root rules file"),
    }
}

/// The imports of an `AGENTS.md` whose target `opencode.json` does not list: `OpenCode` 2
/// injects the `@path` line as text and never loads the file.
fn unseen_by_opencode(path: &Path, text: &str, snapshot: &Snapshot) -> Vec<Finding> {
    if classify(path) != Some(Kind::Agents) {
        return Vec::new();
    }
    let config = snapshot.opencode_config.as_deref().unwrap_or_default();
    imports::repository_targets(path, text)
        .into_iter()
        .filter(|(_, target)| {
            snapshot.imported.get(target).is_some_and(Option::is_some)
                && !opencode::lists(config, target)
        })
        .map(|(import, target)| {
            Finding::new(
                "AM16",
                Verdict::Warn,
                path,
                format!(
                    "line {}: OpenCode reads `@{}` as text and never loads {}",
                    import.line,
                    import.raw,
                    target.display()
                ),
            )
            .with_fix(format!(
                "list {} in the `instructions` array of opencode.json, or move its content \
                 into the AGENTS.md",
                target.display()
            ))
        })
        .collect()
}

// ---------------------------------------------------------------- AM17: structure

/// A paragraph, a list item with its continuation lines, or a table row.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Block {
    pub(crate) line: usize,
    pub(crate) chars: usize,
}

/// Every block of `text`, outside fenced code and HTML comments.
pub(crate) fn blocks(text: &str) -> Vec<Block> {
    let mut found = Vec::new();
    let mut open = false;
    for line in markdown::lines(text) {
        let trimmed = line.text.trim();
        let block = Block {
            line: line.number,
            chars: trimmed.chars().count(),
        };
        open = place(&mut found, open, &shape(line.region, trimmed), block);
    }
    found
}

/// Adds `block` to `found` as `shape` says; returns whether a block is still open.
fn place(found: &mut Vec<Block>, open: bool, shape: &Shape, block: Block) -> bool {
    match shape {
        Shape::Break => false,
        Shape::Row => {
            found.push(block);
            false
        }
        Shape::Start => {
            found.push(block);
            true
        }
        Shape::Text => {
            if let Some(last) = found.last_mut().filter(|_| open) {
                last.chars = last.chars.saturating_add(block.chars).saturating_add(1);
            } else {
                found.push(block);
            }
            true
        }
    }
}

enum Shape {
    /// Ends the current block: a blank line, a heading, a rule, code, or a comment.
    Break,
    /// A table row: a block of its own.
    Row,
    /// Opens a block: a list item.
    Start,
    /// Continues the current block, or opens one.
    Text,
}

fn shape(region: Region, line: &str) -> Shape {
    if region != Region::Prose || line.is_empty() || is_heading(line) || is_rule(line) {
        Shape::Break
    } else if line.starts_with('|') {
        Shape::Row
    } else if is_list_item(line) {
        Shape::Start
    } else {
        Shape::Text
    }
}

fn is_heading(line: &str) -> bool {
    let level = line.chars().take_while(|c| *c == '#').count();
    (1..=6).contains(&level) && line.chars().nth(level).is_none_or(char::is_whitespace)
}

fn is_rule(line: &str) -> bool {
    line.len() >= 3
        && ['-', '*', '_']
            .iter()
            .any(|mark| line.chars().all(|c| c == *mark))
}

/// `- x`, `* x`, `+ x`, `1. x`, `1) x`.
fn is_list_item(line: &str) -> bool {
    list_marker(line).is_some()
}

/// The length of the list marker that opens `line`, its space included.
fn list_marker(line: &str) -> Option<usize> {
    if ["- ", "* ", "+ "]
        .iter()
        .any(|marker| line.starts_with(marker))
    {
        return Some(2);
    }
    let digits = line.chars().take_while(char::is_ascii_digit).count();
    let rest = line.get(digits..)?;
    (digits > 0 && (rest.starts_with(". ") || rest.starts_with(") ")))
        .then(|| digits.saturating_add(2))
}

/// What the blocks over budget are, or `None` when there is none.
fn dense_blocks(long: &[Block]) -> Option<String> {
    let longest = long.iter().max_by_key(|block| block.chars)?;
    if long.len() == 1 {
        return Some(format!(
            "a block of {} chars at line {} (over {BLOCK_CHARS})",
            longest.chars, longest.line
        ));
    }
    let numbers: Vec<usize> = long.iter().map(|block| block.line).collect();
    Some(format!(
        "{} blocks over {BLOCK_CHARS} chars ({}; the longest, {} chars, at line {})",
        long.len(),
        lines_list(&numbers),
        longest.chars,
        longest.line
    ))
}

/// `AM17`: headings and blocks short enough to follow.
fn structure(file: &Judged<'_>) -> Vec<Finding> {
    let long: Vec<Block> = blocks(file.text)
        .into_iter()
        .filter(|block| block.chars > BLOCK_CHARS)
        .collect();
    let headings = prose(file.text)
        .filter(|line| is_heading(line.text.trim()))
        .count();
    let lines = file.text.lines().count();
    let dense = dense_blocks(&long).map(|what| {
        Finding::new(
            "AM17",
            Verdict::Warn,
            &file.path,
            format!(
                "{what}: dense paragraphs are harder for Claude to follow than headers and \
                 bullets"
            ),
        )
        .with_fix(
            "split each into short list items under a heading; move reference detail into a \
             linked doc",
        )
    });
    let flat = (headings == 0 && lines > HEADING_FLOOR).then(|| {
        Finding::new(
            "AM17",
            Verdict::Warn,
            &file.path,
            format!("{lines} lines and no heading"),
        )
        .with_fix("group related instructions under `##` headings")
    });
    dense.into_iter().chain(flat).collect()
}

// ---------------------------------------------------------------- AM18: emphasis

/// The line of every emphasis marker in `text`, outside code.
pub(crate) fn emphasis_markers(text: &str) -> Vec<usize> {
    prose(text)
        .flat_map(|line| {
            let plain: String = outside_code(line.text).collect();
            let count = words(&plain).saturating_add(bold(&plain));
            core::iter::repeat_n(line.number, count)
        })
        .collect()
}

fn words(line: &str) -> usize {
    line.split(|c: char| !c.is_alphanumeric())
        .filter(|word| EMPHASIS_WORDS.contains(word))
        .count()
}

/// Bold spans in `line`, except one that opens the line's content, a list item, or a table
/// cell: that one is a label.
fn bold(line: &str) -> usize {
    let content = content_start(line);
    let cells: Vec<&str> = if content.starts_with('|') {
        content.split('|').collect()
    } else {
        vec![content]
    };
    cells
        .iter()
        .map(|cell| {
            let spans = cell.split("**").skip(1).step_by(2).count();
            let label = cell.trim_start().starts_with("**");
            spans.saturating_sub(usize::from(label))
        })
        .sum()
}

/// `line` without leading whitespace, quote markers, and a list marker.
fn content_start(line: &str) -> &str {
    let text = line.trim_start().trim_start_matches('>').trim_start();
    list_marker(text)
        .and_then(|at| text.get(at..))
        .unwrap_or(text)
        .trim_start()
}

/// `AM18`: emphasis spent on a few rules.
fn emphasis(file: &Judged<'_>) -> Vec<Finding> {
    let markers = emphasis_markers(file.text);
    if markers.len() <= EMPHASIS_BUDGET {
        return Vec::new();
    }
    vec![
        Finding::new(
            "AM18",
            Verdict::Warn,
            &file.path,
            format!(
                "{} emphasis markers ({}; budget {EMPHASIS_BUDGET}): emphasis raises a rule only \
                 relative to the quieter text around it",
                markers.len(),
                lines_list(&dedup(&markers))
            ),
        )
        .with_fix(
            "keep emphasis on the two or three rules that cost most when broken; enforce a \
             zero-exception rule with a hook or a deny rule, not capitals",
        ),
    ]
}

fn dedup(numbers: &[usize]) -> Vec<usize> {
    let mut unique = numbers.to_vec();
    unique.dedup();
    unique
}

// ---------------------------------------------------------------- AM19: references

/// A path the file names, with its line.
struct Reference {
    line: usize,
    path: String,
}

/// Repository paths in code spans, and relative link targets.
fn named(text: &str, files: &[PathBuf]) -> Vec<Reference> {
    let spans = prose(text).flat_map(|line| {
        code_spans(line.text)
            .filter(|span| is_repository_path(span, files))
            .map(move |span| Reference {
                line: line.number,
                path: span.to_owned(),
            })
            .collect::<Vec<_>>()
    });
    let links = markdown::links(text)
        .into_iter()
        .map(|(line, path)| Reference { line, path });
    spans.chain(links).collect()
}

/// A code span that names a path in the repository: no spaces, a `/`, none of `<>*{}$:=@`,
/// and a first segment that exists.
fn is_repository_path(span: &str, files: &[PathBuf]) -> bool {
    let shaped = !span.is_empty()
        && span.contains('/')
        && !span.contains(|c: char| c.is_whitespace() || "<>*{}$:=@".contains(c))
        && !span.starts_with(['/', '~', '-']);
    let first = span
        .trim_start_matches("./")
        .split('/')
        .next()
        .unwrap_or_default();
    shaped && !first.is_empty() && first != ".." && exists(Path::new(first), files)
}

/// Whether `path` is a file of the repository or a directory that holds one.
fn exists(path: &Path, files: &[PathBuf]) -> bool {
    path.as_os_str().is_empty() || files.iter().any(|file| file.starts_with(path))
}

/// Whether `reference`, from the file at `from`, resolves to something, from the file's
/// directory or from the root.
fn resolves(from: &Path, reference: &str, files: &[PathBuf]) -> bool {
    let dir = from.parent().unwrap_or_else(|| Path::new(""));
    [dir, Path::new("")]
        .iter()
        .filter_map(|base| markdown::resolve(base, reference))
        .any(|path| exists(&path, files))
}

/// `AM19`: the paths that the instruction files name resolve.
fn references(snapshot: &Snapshot, files: &[Judged<'_>]) -> Vec<Finding> {
    if files.is_empty() {
        return vec![Finding::new(
            "AM19",
            Verdict::NotApplicable,
            ".",
            "no instruction file to judge",
        )];
    }
    let found = files
        .iter()
        .filter_map(|file| dangling(file, &snapshot.files))
        .collect();
    or_pass(
        found,
        Finding::new(
            "AM19",
            Verdict::Pass,
            ".",
            "every repository path and link that the instruction files name resolves",
        ),
    )
}

fn dangling(file: &Judged<'_>, files: &[PathBuf]) -> Option<Finding> {
    let missing: Vec<Reference> = named(file.text, files)
        .into_iter()
        .filter(|reference| !resolves(&file.path, &reference.path, files))
        .collect();
    if missing.is_empty() {
        return None;
    }
    let shown: Vec<String> = missing
        .iter()
        .take(SHOWN)
        .map(|reference| format!("`{}` (line {})", reference.path, reference.line))
        .collect();
    let more = missing.len().saturating_sub(SHOWN);
    let tail = if more > 0 {
        format!(" and {more} more")
    } else {
        String::new()
    };
    Some(
        Finding::new(
            "AM19",
            Verdict::Warn,
            &file.path,
            format!(
                "{} {} to nothing: {}{tail}",
                missing.len(),
                if missing.len() == 1 {
                    "path resolves"
                } else {
                    "paths resolve"
                },
                shown.join(", ")
            ),
        )
        .with_fix("fix or remove each one: an agent that follows it finds nothing"),
    )
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{
        BLOCK_CHARS, Block, EMPHASIS_BUDGET, HEADING_FLOOR, blocks, emphasis_markers, findings,
    };
    use crate::snapshot::{Entry, RulesFile, Snapshot};
    use std::path::PathBuf;
    use vitals_utils::Verdict;

    fn of(snapshot: &Snapshot, probe: &str) -> Vec<(Verdict, String, String)> {
        findings(snapshot)
            .iter()
            .filter(|finding| finding.probe() == probe)
            .map(|finding| {
                (
                    finding.verdict(),
                    finding.evidence().display().to_string(),
                    finding.message().to_owned(),
                )
            })
            .collect()
    }

    fn agents(text: &str) -> Snapshot {
        Snapshot {
            agents_md: Some(text.to_owned()),
            ..Snapshot::default()
        }
    }

    fn paths(list: &[&str]) -> Vec<PathBuf> {
        list.iter().map(PathBuf::from).collect()
    }

    fn nested(path: &str, text: &str) -> Entry {
        Entry {
            path: PathBuf::from(path),
            file: RulesFile {
                content: Some(text.to_owned()),
                link: None,
            },
        }
    }

    #[test]
    fn blocks_are_paragraphs_list_items_and_rows() {
        let text = "# Title\npara one\ncontinues\n\n- item\n  more\n- next\n| a | b |\n\
                    ```\ncode\n```\nafter\n<!-- c -->\nlast\n---\nrule\n";
        let found: Vec<(usize, usize)> = blocks(text)
            .iter()
            .map(|Block { line, chars }| (*line, *chars))
            .collect();
        assert_eq!(
            found,
            [(2, 18), (5, 11), (7, 6), (8, 9), (12, 5), (14, 4), (16, 4)]
        );
    }

    #[test]
    fn numbered_items_open_blocks_and_hashes_need_a_space() {
        let text = "1. one\n2) two\n+ three\n12.no\n#hashtag\n####### seven\n## real\n***\n";
        let found: Vec<usize> = blocks(text).iter().map(|block| block.line).collect();
        assert_eq!(found, [1, 2, 3]);
        let tagged = agents(&format!("#hashtag\n{}", "- rule\n".repeat(30)));
        assert_eq!(of(&tagged, "AM17")[0].2, "31 lines and no heading");
    }

    #[test]
    fn structure_flags_long_blocks_and_missing_headings() {
        let long = "x".repeat(BLOCK_CHARS.saturating_add(1));
        let at_limit = "y".repeat(BLOCK_CHARS);
        let one = agents(&format!("# Rules\n{long}\n\n{at_limit}\n"));
        let found = of(&one, "AM17");
        assert_eq!(found.len(), 1);
        assert!(
            found[0]
                .2
                .starts_with("a block of 401 chars at line 2 (over 400)")
        );
        let two = agents(&format!("# Rules\n{long}\n\n- {long}\n"));
        assert!(
            of(&two, "AM17")[0]
                .2
                .starts_with("2 blocks over 400 chars (lines 2, 4;")
        );
        let flat = agents(&"- rule\n".repeat(HEADING_FLOOR.saturating_add(1)));
        assert_eq!(of(&flat, "AM17")[0].2, "31 lines and no heading");
        let short = agents(&"- rule\n".repeat(HEADING_FLOOR));
        assert_eq!(of(&short, "AM17")[0].0, Verdict::Pass);
        assert_eq!(
            of(&Snapshot::default(), "AM17")[0].0,
            Verdict::NotApplicable
        );
    }

    #[test]
    fn emphasis_counts_capitals_and_inline_bold_but_not_labels_or_code() {
        let text = "IMPORTANT: run tests. You MUST and must not.\n\
                    - **Label.** then **inline** and `NEVER` in code\n\
                    | **Cell** | a **b** |\n\
                    **Pool:** text\n\
                    > **Quote** label\n\
                    JAMAIS, IMPÉRATIF; Nevermind\n\
                    ```\nALWAYS\n```\n";
        assert_eq!(emphasis_markers(text), [1, 1, 2, 3, 6, 6]);
    }

    #[test]
    fn emphasis_budget_edges() {
        let at = agents(&"- NEVER\n".repeat(EMPHASIS_BUDGET));
        assert_eq!(of(&at, "AM18")[0].0, Verdict::Pass);
        let over = agents(&"- NEVER\n".repeat(EMPHASIS_BUDGET.saturating_add(1)));
        let found = of(&over, "AM18");
        assert_eq!(found[0].0, Verdict::Warn);
        assert!(
            found[0]
                .2
                .starts_with("4 emphasis markers (lines 1, 2, 3, 4; budget 3)")
        );
        let many = agents(&"- NEVER\n".repeat(7));
        assert!(
            of(&many, "AM18")[0]
                .2
                .contains("lines 1, 2, 3, 4, 5 and 2 more")
        );
    }

    #[test]
    fn references_judge_repository_paths_and_relative_links() {
        let text = "See `docs/guide.md`, `docs/gone.md`, `docs/`, `/etc/fstab`, `ansible/site.yml`,\n\
                    `src/*.rs`, `a b/c`, `apps/<gate>-chkr/`, `~/x/y`, `../up/x`.\n\
                    [guide](docs/guide.md) [lost](docs/lost.md) [web](https://x.y/z)\n";
        let snapshot = Snapshot {
            files: paths(&["docs/guide.md", "src/main.rs", "pkg/web/notes.md"]),
            ..agents(text)
        };
        let found = of(&snapshot, "AM19");
        assert_eq!(found[0].0, Verdict::Warn);
        assert_eq!(
            found[0].2,
            "2 paths resolve to nothing: `docs/gone.md` (line 1), `docs/lost.md` (line 3)"
        );
        let nested_link = Snapshot {
            nested: vec![nested(
                "pkg/web/AGENTS.md",
                "[n](notes.md) `pkg/web/notes.md`\n",
            )],
            files: paths(&["pkg/web/notes.md"]),
            ..Snapshot::default()
        };
        assert_eq!(of(&nested_link, "AM19")[0].0, Verdict::Pass);
        let one = Snapshot {
            files: paths(&["docs/a.md"]),
            ..agents("`docs/b.md`\n")
        };
        assert!(
            of(&one, "AM19")[0]
                .2
                .starts_with("1 path resolves to nothing")
        );
        let six = Snapshot {
            files: paths(&["docs/a.md"]),
            ..agents(&"`docs/none.md`\n".repeat(6))
        };
        assert!(of(&six, "AM19")[0].2.ends_with("(line 5) and 1 more"));
        assert_eq!(
            of(&Snapshot::default(), "AM19")[0].0,
            Verdict::NotApplicable
        );
    }

    #[test]
    fn imports_warn_when_missing_or_unseen_by_opencode() {
        let imported = [
            (PathBuf::from("docs/style.md"), Some("# Style\n".to_owned())),
            (PathBuf::from("docs/gone.md"), None),
        ]
        .into_iter()
        .collect();
        let snapshot = Snapshot {
            agents_md: Some("@docs/style.md\n@docs/gone.md\n@~/me.md\n".to_owned()),
            claude_md: RulesFile {
                content: Some("@AGENTS.md\n@docs/style.md\n".to_owned()),
                link: None,
            },
            imported,
            ..Snapshot::default()
        };
        let found = of(&snapshot, "AM16");
        let messages: Vec<&str> = found
            .iter()
            .map(|(_, _, message)| message.as_str())
            .collect();
        assert_eq!(
            messages,
            [
                "line 2: `@docs/gone.md` imports nothing: no file is there",
                "line 1: OpenCode reads `@docs/style.md` as text and never loads docs/style.md",
                "line 1: `@AGENTS.md` imports nothing: no file is there",
            ]
        );
    }

    #[test]
    fn imports_that_opencode_lists_or_cannot_see_pass() {
        let imported =
            std::iter::once((PathBuf::from("docs/style.md"), Some("# Style\n".to_owned())))
                .collect();
        let snapshot = Snapshot {
            imported,
            ..Snapshot::default()
        };
        let listed = Snapshot {
            opencode_config: Some("{\"instructions\": [\"docs/style.md\"]}".to_owned()),
            agents_md: Some("@docs/style.md\n".to_owned()),
            ..snapshot
        };
        let listed_found = of(&listed, "AM16");
        assert!(
            listed_found
                .iter()
                .all(|(_, _, message)| !message.contains("OpenCode"))
        );
        assert_eq!(
            of(&agents("# Rules\n"), "AM16")[0].0,
            Verdict::NotApplicable
        );
        let external = agents("@~/.claude/me.md\n");
        assert_eq!(of(&external, "AM16")[0].0, Verdict::Pass);
    }

    #[test]
    fn imported_files_are_judged_once() {
        let imported =
            std::iter::once((PathBuf::from("docs/rules.md"), Some("- ALWAYS\n".repeat(4))))
                .collect();
        let snapshot = Snapshot {
            agents_md: Some("@docs/rules.md\n".to_owned()),
            nested: vec![nested("docs/rules.md", &"- ALWAYS\n".repeat(4))],
            imported,
            ..Snapshot::default()
        };
        let found = of(&snapshot, "AM18");
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].1, "docs/rules.md");
        let unread = Snapshot {
            nested: vec![nested("docs/agents.md", &"- ALWAYS\n".repeat(4))],
            ..agents("# Rules\n")
        };
        assert_eq!(of(&unread, "AM18")[0].0, Verdict::Pass);
    }
}
