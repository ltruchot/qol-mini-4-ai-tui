//! Filesystem boundary: the only reads gates make, with "absent" kept apart from "unreadable".
#![expect(
    clippy::disallowed_methods,
    reason = "boundary: filesystem reads for every gate"
)]

use std::ffi::OsStr;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use ignore::{DirEntry, WalkBuilder};

use crate::error::Error;

/// Fails unless `path` is a directory.
///
/// # Errors
///
/// [`Error::Read`] when `path` cannot be inspected (for example, it does not exist), and
/// [`Error::NotADirectory`] when it is a file.
pub fn require_dir(path: &Path) -> Result<(), Error> {
    let metadata = std::fs::metadata(path).map_err(|source| read_error(path, source))?;
    if metadata.is_dir() {
        Ok(())
    } else {
        Err(Error::NotADirectory {
            path: path.to_path_buf(),
        })
    }
}

/// The UTF-8 content of `path`, or `None` when nothing is there. A dangling symbolic link
/// counts as nothing.
///
/// # Errors
///
/// [`Error::Read`] when the path exists but cannot be read as UTF-8 text.
pub fn read_optional(path: &Path) -> Result<Option<String>, Error> {
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(source) if source.kind() == ErrorKind::NotFound => Ok(None),
        Err(source) => Err(read_error(path, source)),
    }
}

/// The content of the file at `path`, invalid UTF-8 replaced, or `None` when no file is
/// there: nothing, a directory, or a path through a regular file.
///
/// For files that another file points to (an `@path` import), where the target may be
/// anything.
///
/// # Errors
///
/// [`Error::Read`] when the file exists but cannot be read (for example, permission
/// denied).
pub fn read_lossy(path: &Path) -> Result<Option<String>, Error> {
    match std::fs::read(path) {
        Ok(bytes) => Ok(Some(String::from_utf8_lossy(&bytes).into_owned())),
        Err(source)
            if matches!(
                source.kind(),
                ErrorKind::NotFound | ErrorKind::NotADirectory | ErrorKind::IsADirectory
            ) =>
        {
            Ok(None)
        }
        Err(source) => Err(read_error(path, source)),
    }
}

/// Whether anything is at `path`: a file, a directory, or a symbolic link whose target
/// exists. A dangling link, and a path through a regular file (`file.md/SKILL.md`), count
/// as nothing.
///
/// # Errors
///
/// [`Error::Read`] when `path` cannot be inspected (for example, permission denied).
pub fn exists(path: &Path) -> Result<bool, Error> {
    match std::fs::metadata(path) {
        Ok(_) => Ok(true),
        Err(source)
            if matches!(
                source.kind(),
                ErrorKind::NotFound | ErrorKind::NotADirectory
            ) =>
        {
            Ok(false)
        }
        Err(source) => Err(read_error(path, source)),
    }
}

/// Every directory above `root`, nearest first, up to the filesystem root: `root` is made
/// absolute and its symbolic links resolved first.
///
/// # Errors
///
/// [`Error::Read`] when `root` does not exist or cannot be resolved.
pub fn parent_dirs(root: &Path) -> Result<Vec<PathBuf>, Error> {
    Ok(canonical(root)?
        .ancestors()
        .skip(1)
        .map(Path::to_path_buf)
        .collect())
}

/// The target of `path` when it is a symbolic link, as written in the link; `None` when it
/// is not a link or does not exist.
///
/// # Errors
///
/// [`Error::Read`] when `path` cannot be inspected.
pub fn link_target(path: &Path) -> Result<Option<PathBuf>, Error> {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_symlink() => std::fs::read_link(path)
            .map(Some)
            .map_err(|source| read_error(path, source)),
        Ok(_) => Ok(None),
        Err(source) if source.kind() == ErrorKind::NotFound => Ok(None),
        Err(source) => Err(read_error(path, source)),
    }
}

/// `path` made absolute, with every symbolic link resolved.
///
/// # Errors
///
/// [`Error::Read`] when `path` does not exist or cannot be resolved.
pub fn canonical(path: &Path) -> Result<PathBuf, Error> {
    std::fs::canonicalize(path).map_err(|source| read_error(path, source))
}

/// The current user's home directory, when the platform defines one.
#[must_use]
pub fn home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "wasi")]
    {
        // WASI defines no home directory: the host passes it as `HOME`.
        std::env::var_os("HOME")
            .filter(|home| !home.is_empty())
            .map(PathBuf::from)
    }
    #[cfg(not(target_os = "wasi"))]
    {
        std::env::home_dir()
    }
}

/// Every file and symbolic link under `root`, relative to it, as an agent working in the
/// repository sees the tree.
///
/// Hidden files are included; `.gitignore` and `.ignore` rules are honored, without the
/// user's global gitignore so the result does not depend on the machine. `.git/` and
/// `.claude/worktrees/` (agent worktrees, full copies of the repository) are skipped.
///
/// # Errors
///
/// [`Error::Walk`] when a directory cannot be read.
pub fn project_files(root: &Path) -> Result<Vec<PathBuf>, Error> {
    walk(
        root,
        WalkBuilder::new(root)
            .hidden(false)
            .git_global(false)
            .require_git(false),
    )
}

/// Every file and symbolic link under `dir`, relative to it, with no ignore rule applied:
/// the tree an agent loads from a skill root, which no `.gitignore` filters.
///
/// `dir` itself is followed when it is a symbolic link; links below it are listed, not
/// followed. `.git/` is skipped.
///
/// # Errors
///
/// [`Error::Walk`] when `dir` does not exist or a directory cannot be read.
pub fn tree_files(dir: &Path) -> Result<Vec<PathBuf>, Error> {
    walk(dir, WalkBuilder::new(dir).standard_filters(false))
}

/// Sorted: a directory lists its entries in an order that depends on the filesystem and
/// on the platform, and a gate's output must not.
fn walk(root: &Path, builder: &mut WalkBuilder) -> Result<Vec<PathBuf>, Error> {
    let mut files = builder
        .filter_entry(|entry| !skipped(entry.path()))
        .build()
        .filter_map(|entry| relative_file(root, entry).transpose())
        .collect::<Result<Vec<_>, _>>()?;
    files.sort();
    Ok(files)
}

fn skipped(path: &Path) -> bool {
    path.file_name() == Some(OsStr::new(".git")) || path.ends_with(".claude/worktrees")
}

fn relative_file(
    root: &Path,
    entry: Result<DirEntry, ignore::Error>,
) -> Result<Option<PathBuf>, Error> {
    let entry = entry?;
    // A linked root is listed as a link at depth 0: it is the walk's root, not a file in it.
    let listed = entry.depth() > 0
        && entry
            .file_type()
            .is_some_and(|kind| kind.is_file() || kind.is_symlink());
    Ok(listed
        .then(|| entry.path().strip_prefix(root).ok().map(Path::to_path_buf))
        .flatten())
}

fn read_error(path: &Path, source: std::io::Error) -> Error {
    Error::Read {
        path: path.to_path_buf(),
        source,
    }
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{
        canonical, exists, home_dir, link_target, parent_dirs, project_files, read_optional,
        require_dir, tree_files,
    };
    use crate::error::Error;
    use std::fs;

    #[test]
    fn require_dir_accepts_a_directory_only() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file");
        fs::write(&file, "x").unwrap();
        assert!(require_dir(dir.path()).is_ok());
        assert!(matches!(
            require_dir(&file),
            Err(Error::NotADirectory { .. })
        ));
        assert!(matches!(
            require_dir(&dir.path().join("missing")),
            Err(Error::Read { .. })
        ));
    }

    #[test]
    fn read_optional_tells_absent_from_unreadable() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("AGENTS.md");
        fs::write(&file, "# Rules\n").unwrap();
        assert_eq!(read_optional(&file).unwrap().as_deref(), Some("# Rules\n"));
        assert_eq!(read_optional(&dir.path().join("missing")).unwrap(), None);
        assert!(matches!(read_optional(dir.path()), Err(Error::Read { .. })));
    }

    #[test]
    fn link_target_reads_links_only() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("AGENTS.md");
        fs::write(&file, "x").unwrap();
        assert_eq!(link_target(&file).unwrap(), None);
        assert_eq!(link_target(&dir.path().join("missing")).unwrap(), None);
        // A path through a regular file cannot be inspected at all.
        assert!(matches!(
            link_target(&file.join("child")),
            Err(Error::Read { .. })
        ));
    }

    fn tree(paths: &[&str]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for relative in paths {
            let path = dir.path().join(relative);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, "x").unwrap();
        }
        dir
    }

    #[test]
    fn project_files_lists_hidden_files_and_honors_ignore_rules() {
        let dir = tree(&[
            "AGENTS.md",
            ".claude/rules/a.md",
            "pkg/AGENTS.md",
            ".gitignore",
            "build/AGENTS.md",
            ".git/AGENTS.md",
            ".claude/worktrees/wt/AGENTS.md",
        ]);
        fs::write(dir.path().join(".gitignore"), "build/\n").unwrap();
        let mut files = project_files(dir.path()).unwrap();
        files.sort();
        let expected: Vec<std::path::PathBuf> = [
            ".claude/rules/a.md",
            ".gitignore",
            "AGENTS.md",
            "pkg/AGENTS.md",
        ]
        .iter()
        .map(Into::into)
        .collect();
        assert_eq!(files, expected);
    }

    #[test]
    fn project_files_of_a_missing_root_is_a_walk_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(matches!(
            project_files(&dir.path().join("missing")),
            Err(Error::Walk(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn tree_files_ignores_no_rule_and_follows_only_a_linked_root() {
        let dir = tree(&[
            "real/.gitignore",
            "real/a/SKILL.md",
            "real/.hidden/x.md",
            "real/.git/HEAD",
            "elsewhere/b/SKILL.md",
        ]);
        fs::write(dir.path().join("real/.gitignore"), "*\n").unwrap();
        std::os::unix::fs::symlink("../elsewhere/b", dir.path().join("real/b")).unwrap();
        std::os::unix::fs::symlink("real", dir.path().join("link")).unwrap();
        let mut files = tree_files(&dir.path().join("link")).unwrap();
        files.sort();
        let expected: Vec<std::path::PathBuf> = [".gitignore", ".hidden/x.md", "a/SKILL.md", "b"]
            .iter()
            .map(Into::into)
            .collect();
        assert_eq!(files, expected);
        assert!(matches!(
            tree_files(&dir.path().join("missing")),
            Err(Error::Walk(_))
        ));
    }

    #[test]
    fn canonical_resolves_existing_paths_only() {
        let dir = tempfile::tempdir().unwrap();
        let resolved = canonical(&dir.path().join(".")).unwrap();
        assert!(resolved.is_absolute());
        assert!(matches!(
            canonical(&dir.path().join("missing")),
            Err(Error::Read { .. })
        ));
    }

    #[test]
    fn home_dir_is_absolute_when_defined() {
        assert!(home_dir().is_none_or(|home| home.is_absolute()));
    }

    #[cfg(unix)]
    #[test]
    fn project_files_lists_symbolic_links() {
        let dir = tree(&["AGENTS.md"]);
        std::os::unix::fs::symlink("AGENTS.md", dir.path().join("CLAUDE.md")).unwrap();
        let mut files = project_files(dir.path()).unwrap();
        files.sort();
        assert_eq!(
            files,
            [std::path::PathBuf::from("AGENTS.md"), "CLAUDE.md".into()]
        );
    }

    #[cfg(unix)]
    #[test]
    fn link_target_returns_the_target_as_written() {
        let dir = tempfile::tempdir().unwrap();
        let link = dir.path().join("CLAUDE.md");
        std::os::unix::fs::symlink("AGENTS.md", &link).unwrap();
        assert_eq!(
            link_target(&link).unwrap(),
            Some(std::path::PathBuf::from("AGENTS.md"))
        );
        // Dangling: the target does not exist, so there is no content.
        assert_eq!(read_optional(&link).unwrap(), None);
    }

    #[test]
    fn exists_sees_files_and_directories_only() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("SKILL.md");
        fs::write(&file, "x").unwrap();
        assert!(exists(&file).unwrap());
        assert!(exists(dir.path()).unwrap());
        assert!(!exists(&dir.path().join("missing")).unwrap());
        assert!(!exists(&file.join("SKILL.md")).unwrap());
    }

    #[test]
    fn parent_dirs_climb_to_the_filesystem_root() {
        let dir = tempfile::tempdir().unwrap();
        let repo = dir.path().join("work/repo");
        fs::create_dir_all(&repo).unwrap();
        let parents = parent_dirs(&repo).unwrap();
        assert_eq!(parents[0], canonical(&dir.path().join("work")).unwrap());
        assert_eq!(parents.last().unwrap(), std::path::Path::new("/"));
        assert!(matches!(
            parent_dirs(&dir.path().join("missing")),
            Err(Error::Read { .. })
        ));
    }

    #[cfg(unix)]
    #[test]
    fn exists_treats_a_dangling_link_as_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let link = dir.path().join("skill");
        std::os::unix::fs::symlink("missing", &link).unwrap();
        assert!(!exists(&link).unwrap());
    }
}
