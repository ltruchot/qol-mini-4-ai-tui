//! Which instruction files Claude Code and `OpenCode` load from a directory tree: pure path
//! classification, no I/O.
//!
//! Claude Code (memory docs): `CLAUDE.md`, `.claude/CLAUDE.md`, and `CLAUDE.local.md` in the
//! working directory and every directory above it load at launch, and any of them disables
//! every `AGENTS.md`; the same files in subdirectories load on demand, as does a
//! subdirectory's `AGENTS.md` when it has none of them; `.claude/rules/**/*.md` load at
//! launch or, with `paths`, on demand. `AGENTS.local.md` and `AGENTS.override.md` are not
//! read. `OpenCode` 2 loads only `AGENTS.md`: every one from the working directory up to the
//! home directory (or the project root outside it), plus a subdirectory's when its read tool
//! opens a file there.

use std::ffi::OsStr;
use std::path::{Component, Path};

/// What an instruction file is, by its name and place.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) enum Kind {
    /// `AGENTS.md`: read by both agents.
    Agents,
    /// `.claude/AGENTS.md`: read by Claude Code only.
    ClaudeAgents,
    /// `CLAUDE.md`: read by Claude Code only; disables `AGENTS.md` in its directory.
    Claude,
    /// `.claude/CLAUDE.md`: same as [`Kind::Claude`].
    DotClaude,
    /// `CLAUDE.local.md`: personal, read by Claude Code only; disables `AGENTS.md` too.
    ClaudeLocal,
    /// `.claude/rules/**/*.md`: read by Claude Code only.
    Rule,
    /// A name neither agent loads: `AGENTS.local.md`, `AGENTS.override.md`, or a case
    /// variant such as `agents.md`, which a case-sensitive filesystem never matches.
    Unread,
}

/// Root files that the root probes (`AM01`–`AM06`) already judge.
const ROOT_FILES: [&str; 4] = [
    "AGENTS.md",
    "CLAUDE.md",
    ".claude/CLAUDE.md",
    "CLAUDE.local.md",
];

/// Names that agents look for, compared without case to catch variants.
const KNOWN_NAMES: [&str; 3] = ["agents.md", "claude.md", "claude.local.md"];

/// Files that the agents look for in each parent directory of the repository.
pub(crate) const ANCESTOR_FILES: [&str; 5] = [
    "CLAUDE.md",
    ".claude/CLAUDE.md",
    "CLAUDE.local.md",
    "AGENTS.md",
    ".claude/AGENTS.md",
];

/// The managed `CLAUDE.md` that Claude Code loads in every session on the machine, which no
/// setting excludes: Linux and WSL, then macOS (memory docs, "Deploy organization-wide
/// CLAUDE.md").
pub(crate) const MANAGED_FILES: [&str; 2] = [
    "/etc/claude-code/CLAUDE.md",
    "/Library/Application Support/ClaudeCode/CLAUDE.md",
];

/// The kind of the instruction file at `path`, or `None` when no agent treats it as one.
pub(crate) fn classify(path: &Path) -> Option<Kind> {
    if in_rules_dir(path) {
        return (path.extension() == Some(OsStr::new("md"))).then_some(Kind::Rule);
    }
    let name = path.file_name()?.to_str()?;
    let in_dot_claude = path.parent().and_then(Path::file_name) == Some(OsStr::new(".claude"));
    match (name, in_dot_claude) {
        ("AGENTS.md", true) => Some(Kind::ClaudeAgents),
        ("AGENTS.md", false) => Some(Kind::Agents),
        ("CLAUDE.md", true) => Some(Kind::DotClaude),
        ("CLAUDE.md", false) => Some(Kind::Claude),
        ("CLAUDE.local.md", _) => Some(Kind::ClaudeLocal),
        ("AGENTS.local.md" | "AGENTS.override.md", _) => Some(Kind::Unread),
        _ => KNOWN_NAMES
            .iter()
            .any(|known| name.eq_ignore_ascii_case(known))
            .then_some(Kind::Unread),
    }
}

/// Whether `path` (relative to the root) is one of the root files.
pub(crate) fn is_root_file(path: &Path) -> bool {
    ROOT_FILES.iter().any(|root| path == Path::new(root))
}

/// The directory whose subtree the file at `path` applies to: its parent, or the parent of
/// `.claude/` for the files that live there.
pub(crate) fn scope_dir(path: &Path) -> &Path {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    if parent.file_name() == Some(OsStr::new(".claude")) {
        parent.parent().unwrap_or_else(|| Path::new(""))
    } else {
        parent
    }
}

fn in_rules_dir(path: &Path) -> bool {
    let rules = [
        Component::Normal(OsStr::new(".claude")),
        Component::Normal(OsStr::new("rules")),
    ];
    path.components()
        .collect::<Vec<_>>()
        .windows(2)
        .any(|pair| pair == rules)
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{Kind, classify, is_root_file, scope_dir};
    use std::path::Path;

    fn kind(path: &str) -> Option<Kind> {
        classify(Path::new(path))
    }

    #[test]
    fn names_and_places_map_to_kinds() {
        assert_eq!(kind("pkg/AGENTS.md"), Some(Kind::Agents));
        assert_eq!(kind(".claude/AGENTS.md"), Some(Kind::ClaudeAgents));
        assert_eq!(kind("pkg/CLAUDE.md"), Some(Kind::Claude));
        assert_eq!(kind("pkg/.claude/CLAUDE.md"), Some(Kind::DotClaude));
        assert_eq!(kind("pkg/CLAUDE.local.md"), Some(Kind::ClaudeLocal));
        assert_eq!(kind("/home/dev/CLAUDE.md"), Some(Kind::Claude));
    }

    #[test]
    fn rules_are_markdown_files_anywhere_under_claude_rules() {
        assert_eq!(kind(".claude/rules/testing.md"), Some(Kind::Rule));
        assert_eq!(kind("pkg/.claude/rules/api/style.md"), Some(Kind::Rule));
        assert_eq!(kind(".claude/rules/CLAUDE.md"), Some(Kind::Rule));
        assert_eq!(kind(".claude/rules/notes.txt"), None);
    }

    #[test]
    fn unread_names_and_case_variants_are_flagged() {
        assert_eq!(kind("AGENTS.override.md"), Some(Kind::Unread));
        assert_eq!(kind("pkg/AGENTS.local.md"), Some(Kind::Unread));
        assert_eq!(kind("agents.md"), Some(Kind::Unread));
        assert_eq!(kind("docs/Claude.md"), Some(Kind::Unread));
        assert_eq!(kind("README.md"), None);
        assert_eq!(kind(""), None);
    }

    #[test]
    fn root_files_are_the_four_root_probes_targets() {
        assert!(is_root_file(Path::new("AGENTS.md")));
        assert!(is_root_file(Path::new(".claude/CLAUDE.md")));
        assert!(!is_root_file(Path::new(".claude/AGENTS.md")));
        assert!(!is_root_file(Path::new("pkg/AGENTS.md")));
    }

    #[test]
    fn scope_dir_climbs_out_of_dot_claude() {
        assert_eq!(scope_dir(Path::new("pkg/CLAUDE.md")), Path::new("pkg"));
        assert_eq!(
            scope_dir(Path::new("pkg/.claude/CLAUDE.md")),
            Path::new("pkg")
        );
        assert_eq!(scope_dir(Path::new(".claude/AGENTS.md")), Path::new(""));
        assert_eq!(scope_dir(Path::new("CLAUDE.md")), Path::new(""));
    }
}
