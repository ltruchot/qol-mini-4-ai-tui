//! Where skills live and which agent loads each root: pure path classification, no I/O.
//!
//! Claude Code (skills docs) reads `.claude/skills/<name>/SKILL.md` only. `OpenCode` 2
//! (`config/discovery.ts`, `config/plugin/compatibility.ts`, `config/plugin/skill.ts`)
//! reads `.claude/skills/`, `.agents/skills/`, `.opencode/skills/`, and `.opencode/skill/`,
//! where a directory holding `SKILL.md` is a skill and a `*.md` file directly in the root
//! is one too (`config/plugin/skill-scan.ts`).

use std::path::{Path, PathBuf};

/// The file that makes a directory a skill, for both agents.
pub(crate) const SKILL_MD: &str = "SKILL.md";

/// A skill root, in the order of [`vitals_utils::markers::SKILL_ROOTS`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub(crate) enum Root {
    /// `.claude/skills`: read by both agents.
    Claude,
    /// `.opencode/skills`: read by `OpenCode` only.
    Opencode,
    /// `.opencode/skill`: read by `OpenCode` only.
    OpencodeSingular,
    /// `.agents/skills`: read by `OpenCode` only.
    Agents,
}

impl Root {
    pub(crate) const ALL: [Self; 4] = [
        Self::Claude,
        Self::Opencode,
        Self::OpencodeSingular,
        Self::Agents,
    ];

    /// The root's path relative to the directory that holds it.
    pub(crate) const fn path(self) -> &'static str {
        match self {
            Self::Claude => ".claude/skills",
            Self::Opencode => ".opencode/skills",
            Self::OpencodeSingular => ".opencode/skill",
            Self::Agents => ".agents/skills",
        }
    }

    /// Whether Claude Code loads skills from this root; `OpenCode` loads them from all four.
    pub(crate) const fn claude_reads(self) -> bool {
        matches!(self, Self::Claude)
    }

    fn from_parts(parent: &str, child: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|root| root.path().split_once('/') == Some((parent, child)))
    }
}

/// A path split at the first skill root it crosses.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Located {
    /// The directory that holds the root, relative to the repository root (empty for the
    /// repository root itself).
    pub(crate) scope: PathBuf,
    pub(crate) root: Root,
    /// The path's components below the root.
    pub(crate) rest: Vec<String>,
}

impl Located {
    /// The root directory, relative to the repository root.
    pub(crate) fn root_dir(&self) -> PathBuf {
        self.scope.join(self.root.path())
    }
}

/// Splits `path` at the first skill root it crosses; `None` when it crosses none or holds a
/// component that is not UTF-8.
pub(crate) fn locate(path: &Path) -> Option<Located> {
    let parts = path
        .components()
        .map(|part| part.as_os_str().to_str())
        .collect::<Option<Vec<&str>>>()?;
    let (index, root) = parts.windows(2).enumerate().find_map(|(index, pair)| {
        let [parent, child] = pair else { return None };
        Root::from_parts(parent, child).map(|root| (index, root))
    })?;
    Some(Located {
        scope: parts.iter().take(index).collect(),
        root,
        rest: parts
            .iter()
            .skip(index.saturating_add(2))
            .map(|part| (*part).to_owned())
            .collect(),
    })
}

/// One skill: the directory named `name` in a root, holding `SKILL.md`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub(crate) struct Place {
    pub(crate) scope: PathBuf,
    pub(crate) root: Root,
    pub(crate) name: String,
}

impl Place {
    /// The skill directory, relative to the repository root.
    pub(crate) fn dir(&self) -> PathBuf {
        self.scope.join(self.root.path()).join(&self.name)
    }

    /// The skill's `SKILL.md`, relative to the repository root.
    pub(crate) fn skill_md(&self) -> PathBuf {
        self.dir().join(SKILL_MD)
    }

    /// Whether `other` is the same skill name in a root of the same directory.
    pub(crate) fn same_name(&self, other: &Self) -> bool {
        self.scope == other.scope && self.name == other.name
    }
}

/// How a path below a skill root makes a skill.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Shape {
    /// `<name>/SKILL.md`.
    SkillMd,
    /// `<name>` listed as a file: a skill only when it is a symbolic-link folder that holds
    /// `SKILL.md`, which only the disk can tell.
    Folder,
}

/// The skill name and shape of a path, from its components below a skill root.
pub(crate) fn shape<S: AsRef<str>>(rest: &[S]) -> Option<(&str, Shape)> {
    match rest {
        [name, file] if file.as_ref() == SKILL_MD => Some((name.as_ref(), Shape::SkillMd)),
        [name] => Some((name.as_ref(), Shape::Folder)),
        _ => None,
    }
}

/// The skill that `path` (relative to the repository root) can make, and its shape.
pub(crate) fn place(path: &Path) -> Option<(Place, Shape)> {
    let located = locate(path)?;
    let (name, shape) = shape(&located.rest)?;
    let name = name.to_owned();
    Some((
        Place {
            scope: located.scope,
            root: located.root,
            name,
        },
        shape,
    ))
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{Root, SKILL_MD, Shape, locate, place, shape};
    use std::path::{Path, PathBuf};
    use vitals_utils::markers::SKILL_ROOTS;

    #[test]
    fn roots_match_the_shared_markers_in_order() {
        let paths: Vec<&str> = Root::ALL.iter().map(|root| root.path()).collect();
        assert_eq!(paths, SKILL_ROOTS);
        assert!(Root::Claude.claude_reads());
        assert!(!Root::Agents.claude_reads());
        assert!(!Root::OpencodeSingular.claude_reads());
    }

    #[test]
    fn locate_splits_at_the_first_root() {
        let found = locate(Path::new("apps/web/.agents/skills/deploy/SKILL.md")).unwrap();
        assert_eq!(found.scope, PathBuf::from("apps/web"));
        assert_eq!(found.root, Root::Agents);
        assert_eq!(found.rest, ["deploy", "SKILL.md"]);
        assert_eq!(found.root_dir(), PathBuf::from("apps/web/.agents/skills"));
        let root = locate(Path::new(".opencode/skill/x.md")).unwrap();
        assert_eq!(root.scope, PathBuf::new());
        assert_eq!(root.root, Root::OpencodeSingular);
        assert_eq!(locate(Path::new("docs/skills/x/SKILL.md")), None);
        assert_eq!(locate(Path::new(".claude/rules/a.md")), None);
    }

    #[test]
    fn places_need_their_exact_shape() {
        let (place, found) = place(Path::new(".claude/skills/kaizen/SKILL.md")).unwrap();
        assert_eq!(place.name, "kaizen");
        assert_eq!(found, Shape::SkillMd);
        assert_eq!(
            place.skill_md(),
            PathBuf::from(".claude/skills/kaizen/SKILL.md")
        );
        assert_eq!(
            super::place(Path::new(".claude/skills/kaizen/skill.md")),
            None
        );
        assert_eq!(super::place(Path::new(".claude/skills/a/b/SKILL.md")), None);
        let (folder, linked) = super::place(Path::new("pkg/.claude/skills/shared")).unwrap();
        assert_eq!(folder.dir(), PathBuf::from("pkg/.claude/skills/shared"));
        assert_eq!(linked, Shape::Folder);
        assert_eq!(super::place(Path::new(".claude/skills/a/b")), None);
        assert_eq!(super::place(Path::new("README.md")), None);
        assert_eq!(shape(&["x", SKILL_MD]), Some(("x", Shape::SkillMd)));
        assert_eq!(shape::<&str>(&[]), None);
    }

    #[cfg(unix)]
    #[test]
    fn non_utf8_paths_are_not_located() {
        use std::os::unix::ffi::OsStrExt;
        let name = std::ffi::OsStr::from_bytes(&[0xff]);
        let path = Path::new(".claude/skills").join(name).join("SKILL.md");
        assert_eq!(locate(&path), None);
    }
}
