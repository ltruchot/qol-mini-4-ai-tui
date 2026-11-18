//! Paths that Claude Code and `OpenCode` read, shared across gates (ADR 1, ADR 4).

use std::path::PathBuf;

/// The canonical rules file, read by `OpenCode` and by Claude Code 2.1.277 and later.
pub const AGENTS_MD: &str = "AGENTS.md";

/// Directories that hold project skills, one subdirectory per skill. Claude Code reads only
/// the first; `OpenCode` 2 reads all four (ADR 4, "The skills gate").
pub const SKILL_ROOTS: [&str; 4] = [
    ".claude/skills",
    ".opencode/skills",
    ".opencode/skill",
    ".agents/skills",
];

/// Where a project skill named `name` keeps its `SKILL.md`, one path per skill root.
///
/// # Examples
///
/// ```
/// let paths: Vec<_> = vitals_utils::markers::skill_files("kaizen").collect();
/// assert_eq!(paths[0], std::path::Path::new(".claude/skills/kaizen/SKILL.md"));
/// assert_eq!(paths.len(), 4);
/// ```
pub fn skill_files(name: &str) -> impl Iterator<Item = PathBuf> {
    SKILL_ROOTS
        .into_iter()
        .map(move |root| [root, name, "SKILL.md"].iter().collect())
}
