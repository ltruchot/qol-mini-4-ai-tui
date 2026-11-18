//! Probe `AM20`: the `paths` frontmatter of `.claude/rules` files. Pure functions of a
//! [`Snapshot`].
//!
//! Claude Code (memory docs, "Path-specific rules"): `paths` holds glob patterns, as a YAML
//! list or a comma-separated string; a rule with `paths` loads only when Claude works with a
//! matching file. A pattern that matches no file in the repository never loads its rule.

use std::iter::Peekable;
use std::path::{Path, PathBuf};
use std::str::Chars;

use globset::{GlobBuilder, GlobMatcher};
use vitals_utils::frontmatter::{self, Frontmatter, Mistake};
use vitals_utils::{Finding, Verdict, or_pass};

use crate::cascade::{Kind, classify};
use crate::snapshot::{Entry, Snapshot};

/// How many patterns the brace groups of one rule's `paths` may expand to (memory docs,
/// "Path-specific rules"); past it, Claude Code uses the braced patterns unexpanded.
const BRACE_BUDGET: usize = 1_000;

pub(crate) fn finding(snapshot: &Snapshot) -> Vec<Finding> {
    let rules: Vec<&Entry> = snapshot
        .nested
        .iter()
        .filter(|entry| classify(&entry.path) == Some(Kind::Rule))
        .collect();
    if rules.is_empty() {
        return vec![Finding::new(
            "AM20",
            Verdict::NotApplicable,
            ".claude/rules",
            "no rules files",
        )];
    }
    let found = rules
        .iter()
        .filter_map(|rule| judge(rule, snapshot))
        .collect();
    let noun = if rules.len() == 1 { "file" } else { "files" };
    let pass = format!(
        "{} rules {noun}: every `paths` pattern matches a file",
        rules.len()
    );
    or_pass(
        found,
        Finding::new("AM20", Verdict::Pass, ".claude/rules", pass),
    )
}

fn judge(rule: &Entry, snapshot: &Snapshot) -> Option<Finding> {
    let text = rule.file.content.as_deref()?;
    let warn = |message: String, fix: &str| {
        Finding::new("AM20", Verdict::Warn, &rule.path, message).with_fix(fix)
    };
    let front = frontmatter::read(text);
    if front == Frontmatter::Unclosed {
        return Some(warn(
            "the frontmatter opens on line 1 and no `---` line closes it".to_owned(),
            "close the frontmatter with a `---` line",
        ));
    }
    let field = front.field("paths")?;
    if let Some(broken) = front.first_mistake() {
        return Some(warn(
            format!(
                "line {}: YAML rejects this frontmatter (the value {}), so Claude Code ignores \
                 it and loads the rule in every session",
                broken.line,
                broken.mistake.map_or("", Mistake::reason)
            ),
            "quote the value, or fix the YAML, so that `paths` scopes the rule",
        ));
    }
    let Some(patterns) = front.items("paths") else {
        return Some(warn(
            format!(
                "line {}: `paths` is neither a string nor a list of patterns",
                field.line
            ),
            "write `paths` as a YAML list of glob patterns, or remove it to load the rule \
             in every session",
        ));
    };
    patterns_finding(rule, field.line, &patterns, snapshot)
}

/// The brace budget, then the patterns that match no file.
fn patterns_finding(
    rule: &Entry,
    line: usize,
    patterns: &[String],
    snapshot: &Snapshot,
) -> Option<Finding> {
    let expanded: usize = patterns.iter().map(|pattern| expansions(pattern)).sum();
    if expanded > BRACE_BUDGET {
        return Some(
            Finding::new(
                "AM20",
                Verdict::Warn,
                &rule.path,
                format!(
                    "line {line}: the brace groups of `paths` expand to {expanded} patterns \
                     (budget {BRACE_BUDGET}), so Claude Code uses them unexpanded and they match \
                     no file"
                ),
            )
            .with_fix("split the brace groups into fewer, broader patterns"),
        );
    }
    let scope = scope_of(&rule.path);
    let dead: Vec<String> = patterns
        .iter()
        .filter(|pattern| {
            !matches_any(pattern, scope, &snapshot.files)
                && !snapshot.hidden.contains(&base(scope, pattern))
        })
        .cloned()
        .collect();
    (!dead.is_empty()).then(|| dead_patterns(rule, line, &dead))
}

/// How many patterns the brace groups of `pattern` expand to, nested groups included; 0
/// without braces, which do not count against the budget (memory docs, "Path-specific
/// rules").
fn expansions(pattern: &str) -> usize {
    if pattern.contains('{') {
        sequence(&mut pattern.chars().peekable(), false)
    } else {
        0
    }
}

/// The expansion count of a sequence, up to the `,` or `}` that ends it inside a group.
fn sequence(chars: &mut Peekable<Chars<'_>>, inside: bool) -> usize {
    let mut total = 1_usize;
    while let Some(&c) = chars.peek() {
        if inside && (c == ',' || c == '}') {
            break;
        }
        chars.next();
        if c == '{' {
            total = total.saturating_mul(group(chars));
        }
    }
    total
}

/// The expansion count of a group after its `{`: the sum of its alternatives.
fn group(chars: &mut Peekable<Chars<'_>>) -> usize {
    let mut sum = 0_usize;
    loop {
        sum = sum.saturating_add(sequence(chars, true));
        match chars.next() {
            Some(',') => {}
            _ => return sum,
        }
    }
}

fn dead_patterns(rule: &Entry, line: usize, dead: &[String]) -> Finding {
    let list: Vec<String> = dead.iter().map(|pattern| format!("`{pattern}`")).collect();
    Finding::new(
        "AM20",
        Verdict::Warn,
        &rule.path,
        format!(
            "line {line}: `paths` {} {} no file in the repository, so Claude Code never loads \
             the rule for {}",
            list.join(", "),
            if dead.len() == 1 { "matches" } else { "match" },
            if dead.len() == 1 { "it" } else { "them" },
        ),
    )
    .with_fix("fix each pattern against the repository layout, or remove it")
}

/// The directory that the patterns of the rule at `path` are relative to: the one that
/// holds its `.claude/`.
pub(crate) fn scope_of(path: &Path) -> &Path {
    path.ancestors()
        .find(|dir| dir.file_name() == Some(".claude".as_ref()))
        .and_then(Path::parent)
        .unwrap_or_else(|| Path::new(""))
}

/// The literal directory that `pattern` starts with, relative to the repository root:
/// `scope/dist` for `dist/**/*.js`; `scope` itself when the pattern opens with a glob.
fn base(scope: &Path, pattern: &str) -> PathBuf {
    let glob = effective(pattern);
    let literal: PathBuf = glob
        .split('/')
        .take_while(|part| !part.contains(['*', '?', '[', '{']))
        .collect();
    // The last literal part may name a file (`docs/a.md`): keep the directories only.
    let dirs = if glob.contains(['*', '?', '[', '{']) {
        literal
    } else {
        literal
            .parent()
            .map_or_else(PathBuf::new, Path::to_path_buf)
    };
    scope.join(dirs)
}

/// Every directory that a `paths` pattern of the rules in `nested` starts with.
pub(crate) fn bases(nested: &[Entry]) -> Vec<PathBuf> {
    nested
        .iter()
        .filter(|entry| classify(&entry.path) == Some(Kind::Rule))
        .filter_map(|entry| {
            let text = entry.file.content.as_deref()?;
            let patterns = frontmatter::read(text).items("paths")?;
            let scope = scope_of(&entry.path);
            Some(
                patterns
                    .iter()
                    .map(|pattern| base(scope, pattern))
                    .filter(|dir| dir != scope)
                    .collect::<Vec<_>>(),
            )
        })
        .flatten()
        .collect()
}

/// `pattern` as Claude Code matches it (memory docs, "Path-specific rules"), relative to the
/// base directory: a leading `./` is dropped, a leading `/` anchors it at the base
/// (`/*.md`), and a pattern without `/` matches at any depth (`*.md`: `.md` files anywhere).
fn effective(pattern: &str) -> String {
    let pattern = pattern.strip_prefix("./").unwrap_or(pattern);
    pattern.strip_prefix('/').map_or_else(
        || {
            if pattern.contains('/') {
                pattern.to_owned()
            } else {
                format!("**/{pattern}")
            }
        },
        str::to_owned,
    )
}

fn matches_any(pattern: &str, scope: &Path, files: &[PathBuf]) -> bool {
    matcher(pattern).is_some_and(|glob| {
        files
            .iter()
            .filter_map(|file| file.strip_prefix(scope).ok())
            .any(|file| glob.is_match(file))
    })
}

/// `pattern` as Claude Code's examples use it: `*` stops at `/`, `**` crosses it, braces
/// expand. `None` when it is not a valid glob.
fn matcher(pattern: &str) -> Option<GlobMatcher> {
    GlobBuilder::new(&effective(pattern))
        .literal_separator(true)
        .build()
        .ok()
        .map(|glob| glob.compile_matcher())
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{bases, finding};
    use crate::snapshot::{Entry, RulesFile, Snapshot};
    use std::collections::BTreeSet;
    use std::path::PathBuf;
    use vitals_utils::Verdict;

    fn rule(path: &str, content: &str) -> Entry {
        Entry {
            path: PathBuf::from(path),
            file: RulesFile {
                content: Some(content.to_owned()),
                link: None,
            },
        }
    }

    fn run(rules: Vec<Entry>) -> Vec<(Verdict, String)> {
        let files = [
            "src/api/users.ts",
            "src/api/teams.tsx",
            "pkg/web/src/app.rs",
        ]
        .iter()
        .map(PathBuf::from)
        .collect();
        finding(&Snapshot {
            nested: rules,
            files,
            ..Snapshot::default()
        })
        .iter()
        .map(|found| (found.verdict(), found.message().to_owned()))
        .collect()
    }

    #[test]
    fn no_rules_does_not_apply() {
        assert_eq!(run(Vec::new())[0].0, Verdict::NotApplicable);
    }

    #[test]
    fn matching_patterns_and_unscoped_rules_pass() {
        let found = run(vec![
            rule(
                ".claude/rules/api.md",
                "---\npaths:\n  - \"src/api/**/*.{ts,tsx}\"\n---\n# API\n",
            ),
            rule(".claude/rules/all.md", "# Everywhere\n"),
            rule(
                ".claude/rules/csv.md",
                "---\npaths: src/**/*.ts, docs/x.md\n---\n",
            ),
            rule(
                "pkg/web/.claude/rules/web.md",
                "---\npaths: [\"src/*.rs\"]\n---\n",
            ),
            rule(".claude/rules/other.md", "---\ndescription: x\n---\n"),
        ]);
        assert_eq!(found.len(), 1, "{found:?}");
        assert_eq!(found[0].0, Verdict::Warn);
        assert!(
            found[0].1.contains("`docs/x.md` matches no file"),
            "{}",
            found[0].1
        );
        assert!(found[0].1.contains("for it"));
        let clean = run(vec![rule(".claude/rules/all.md", "# Everywhere\n")]);
        assert_eq!(clean[0].0, Verdict::Pass);
    }

    #[test]
    fn patterns_match_as_the_docs_table_says() {
        // `*.tsx` matches anywhere; `/*.ts` only directly in the base directory.
        let found = run(vec![rule(
            ".claude/rules/a.md",
            "---\npaths: [\"*.tsx\", \"**/*.ts\", \"/*.ts\", \"src/api/*.ts\"]\n---\n",
        )]);
        assert_eq!(found.len(), 1);
        assert!(
            found[0].1.contains("`/*.ts` matches no file"),
            "{}",
            found[0].1
        );
    }

    #[test]
    fn a_yaml_error_or_a_brace_budget_overrun_warns() {
        let broken = run(vec![rule(
            ".claude/rules/a.md",
            "---\npaths: src/**\ndescription: Use when: editing\n---\n",
        )]);
        assert!(broken[0].1.contains("YAML rejects"), "{}", broken[0].1);
        assert!(broken[0].1.contains("every session"));
        let group = "{a,b,c,d,e,f,g,h,i,j}";
        let braces = run(vec![rule(
            ".claude/rules/b.md",
            &format!("---\npaths: [\"src/{group}/{group}/{group}/*.ts\", \"x/{group}.rs\"]\n---\n"),
        )]);
        assert!(
            braces[0].1.contains("expand to 1010 patterns"),
            "{}",
            braces[0].1
        );
        assert_eq!(super::expansions("src/**/*.ts"), 0);
        assert_eq!(super::expansions("{a,{b,c}}/*.{ts,tsx}"), 6);
        assert_eq!(super::expansions("{a,b}/{c,d}/*.{ts,tsx}"), 8);
        assert_eq!(super::expansions("{a,b"), 2);
    }

    #[test]
    fn dot_slash_and_ignored_directories_are_not_dead() {
        let rules = vec![
            rule(
                ".claude/rules/a.md",
                "---\npaths: [\"./src/**\", \"dist/**/*.js\", \"src/**/*.{ts,tsx}\"]\n---\n",
            ),
            rule(
                "pkg/web/.claude/rules/b.md",
                "---\npaths: build/out.txt, *.rs\n---\n",
            ),
        ];
        assert_eq!(
            bases(&rules),
            [
                PathBuf::from("src"),
                PathBuf::from("dist"),
                PathBuf::from("src"),
                PathBuf::from("pkg/web/build"),
            ]
        );
        let found = finding(&Snapshot {
            nested: rules,
            files: vec![PathBuf::from("src/a.ts"), PathBuf::from("pkg/web/x.rs")],
            hidden: BTreeSet::from([PathBuf::from("dist"), PathBuf::from("pkg/web/build")]),
            ..Snapshot::default()
        });
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].verdict(), Verdict::Pass, "{}", found[0].message());
    }

    #[test]
    fn dead_unclosed_and_malformed_paths_warn() {
        let found = run(vec![
            rule(
                ".claude/rules/dead.md",
                "---\npaths: [\"lib/**\", \"*.go\"]\n---\n",
            ),
            rule(".claude/rules/open.md", "---\npaths: src/**\n"),
            rule(".claude/rules/map.md", "---\npaths:\n  key: value\n---\n"),
            rule(".claude/rules/bad.md", "---\npaths: \"src/[\"\n---\n"),
        ]);
        let messages: Vec<&str> = found.iter().map(|(_, message)| message.as_str()).collect();
        assert!(
            messages[0].contains("`lib/**`, `*.go` match no file"),
            "{}",
            messages[0]
        );
        assert!(messages[0].contains("for them"));
        assert!(messages[1].contains("no `---` line closes it"));
        assert!(messages[2].contains("neither a string nor a list"));
        assert!(messages[3].contains("`src/[` matches no file"));
        assert!(found.iter().all(|(verdict, _)| *verdict == Verdict::Warn));
    }
}
