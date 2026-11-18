//! Boundary: reads, once, every file the probes judge. All I/O goes through
//! [`vitals_utils::fs`]; the result is a plain value.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use vitals_utils::markers::{AGENTS_MD, skill_files};
use vitals_utils::{Error, Reach, fs};

use crate::cascade::{ANCESTOR_FILES, MANAGED_FILES, classify, is_root_file};
use crate::imports::{self, Imported};
use crate::rules;

/// An instruction file: its content and, when it is a symbolic link, its target as written.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub(crate) struct RulesFile {
    pub(crate) content: Option<String>,
    pub(crate) link: Option<PathBuf>,
}

/// An instruction file found by a walk, at `path`: relative to the root inside the
/// repository, absolute above it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Entry {
    pub(crate) path: PathBuf,
    pub(crate) file: RulesFile,
}

/// What the probes see of a repository.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub(crate) struct Snapshot {
    pub(crate) agents_md: Option<String>,
    pub(crate) claude_md: RulesFile,
    pub(crate) dot_claude_md: RulesFile,
    pub(crate) claude_local_md: bool,
    pub(crate) todo_md: bool,
    /// The first `kaizen` skill found, relative to the root.
    pub(crate) kaizen_skill: Option<PathBuf>,
    /// Every other instruction file in the repository, in walk order.
    pub(crate) nested: Vec<Entry>,
    /// `opencode.json` and `opencode.jsonc`, concatenated, when either exists.
    pub(crate) opencode_config: Option<String>,
    /// Instruction files in the parent directories; `None` when the run is repository-only.
    pub(crate) ancestors: Option<Vec<Entry>>,
    /// The home directory, when the run reaches the user scope.
    pub(crate) home: Option<PathBuf>,
    /// Every file that an `@path` import reaches inside the repository, relative to the
    /// root: its content, or `None` when no file is there.
    pub(crate) imported: Imported,
    /// Every file of the repository, relative to the root, in walk order.
    pub(crate) files: Vec<PathBuf>,
    /// The managed `CLAUDE.md` files on this machine; `None` when the run is
    /// repository-only.
    pub(crate) managed: Option<Vec<Entry>>,
    /// The directories that a rule's `paths` pattern starts with (`dist` for `dist/**`),
    /// that exist on disk, and that the walk hides (ignored): Claude Code still loads the
    /// rule there.
    pub(crate) hidden: BTreeSet<PathBuf>,
}

pub(crate) fn read(root: &Path, reach: Reach) -> Result<Snapshot, Error> {
    fs::require_dir(root)?;
    let user = reach.includes_user_scope();
    let files = fs::project_files(root)?;
    let mut snapshot = Snapshot {
        agents_md: fs::read_optional(&root.join(AGENTS_MD))?,
        claude_md: rules_file(&root.join("CLAUDE.md"))?,
        dot_claude_md: rules_file(&root.join(".claude/CLAUDE.md"))?,
        claude_local_md: exists(&root.join("CLAUDE.local.md"))?,
        todo_md: exists(&root.join("TODO.md"))?,
        kaizen_skill: kaizen_skill(root)?,
        nested: nested(root, &files)?,
        opencode_config: opencode_config(root)?,
        ancestors: user.then(|| ancestors(root)).transpose()?,
        home: user.then(fs::home_dir).flatten(),
        imported: Imported::new(),
        files,
        managed: user.then(managed).transpose()?,
        hidden: BTreeSet::new(),
    };
    snapshot.imported = imported(root, &snapshot)?;
    snapshot.hidden = hidden(root, &snapshot)?;
    Ok(snapshot)
}

fn hidden(root: &Path, snapshot: &Snapshot) -> Result<BTreeSet<PathBuf>, Error> {
    let mut found = BTreeSet::new();
    for base in rules::bases(&snapshot.nested) {
        let walked = snapshot.files.iter().any(|file| file.starts_with(&base));
        if !walked && fs::exists(&root.join(&base).join("."))? {
            found.insert(base);
        }
    }
    Ok(found)
}

/// Reads every file reachable through `@path` imports from the root and nested
/// instruction files, inside the repository, whatever the depth: the probes apply the
/// four-hop limit.
fn imported(root: &Path, snapshot: &Snapshot) -> Result<Imported, Error> {
    let starts = [
        ("AGENTS.md", snapshot.agents_md.clone()),
        ("CLAUDE.md", snapshot.claude_md.content.clone()),
        (".claude/CLAUDE.md", snapshot.dot_claude_md.content.clone()),
    ]
    .into_iter()
    .filter_map(|(path, text)| Some((PathBuf::from(path), text?)));
    let nested = snapshot
        .nested
        .iter()
        .filter_map(|entry| Some((entry.path.clone(), entry.file.content.clone()?)));
    let mut pending: Vec<(PathBuf, String)> = starts.chain(nested).collect();
    let mut found = Imported::new();
    while let Some((from, text)) = pending.pop() {
        let fresh: BTreeSet<PathBuf> = imports::repository_targets(&from, &text)
            .into_iter()
            .map(|(_, target)| target)
            .filter(|target| !found.contains_key(target))
            .collect();
        for target in fresh {
            let content = fs::read_lossy(&root.join(&target))?;
            pending.extend(content.clone().map(|body| (target.clone(), body)));
            found.insert(target, content);
        }
    }
    Ok(found)
}

fn managed() -> Result<Vec<Entry>, Error> {
    MANAGED_FILES
        .iter()
        .map(|path| entry(PathBuf::from(path), Path::new(path)))
        .filter_map(Result::transpose)
        .collect()
}

fn rules_file(path: &Path) -> Result<RulesFile, Error> {
    Ok(RulesFile {
        content: fs::read_optional(path)?,
        link: fs::link_target(path)?,
    })
}

fn entry(path: PathBuf, on_disk: &Path) -> Result<Option<Entry>, Error> {
    let file = rules_file(on_disk)?;
    let present = file.content.is_some() || file.link.is_some();
    Ok(present.then_some(Entry { path, file }))
}

fn exists(path: &Path) -> Result<bool, Error> {
    fs::read_optional(path).map(|content| content.is_some())
}

fn kaizen_skill(root: &Path) -> Result<Option<PathBuf>, Error> {
    skill_files("kaizen")
        .map(|relative| {
            fs::read_optional(&root.join(&relative)).map(|found| found.map(|_| relative))
        })
        .find_map(Result::transpose)
        .transpose()
}

fn nested(root: &Path, files: &[PathBuf]) -> Result<Vec<Entry>, Error> {
    files
        .iter()
        .filter(|path| classify(path).is_some() && !is_root_file(path))
        .cloned()
        .map(|path| {
            let on_disk = root.join(&path);
            entry(path, &on_disk)
        })
        .filter_map(Result::transpose)
        .collect()
}

fn opencode_config(root: &Path) -> Result<Option<String>, Error> {
    let parts = ["opencode.json", "opencode.jsonc"]
        .iter()
        .map(|name| fs::read_optional(&root.join(name)))
        .collect::<Result<Vec<_>, _>>()?;
    let found: Vec<String> = parts.into_iter().flatten().collect();
    Ok((!found.is_empty()).then(|| found.join("\n")))
}

fn ancestors(root: &Path) -> Result<Vec<Entry>, Error> {
    fs::parent_dirs(root)?
        .into_iter()
        .flat_map(|dir| ANCESTOR_FILES.iter().map(move |name| dir.join(name)))
        .map(|path| entry(path.clone(), &path))
        .filter_map(Result::transpose)
        .collect()
}
