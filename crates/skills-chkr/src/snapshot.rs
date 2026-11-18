//! Boundary: reads, once, every file the probes judge. All I/O goes through
//! [`vitals_utils::fs`]; the result is a plain value.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use vitals_utils::markers::SKILL_ROOTS;
use vitals_utils::{Error, Reach, fs};

use crate::layout::{Place, Root, SKILL_MD, Shape, locate, place, shape};
use crate::user::HOME_ROOTS;

/// One skill in the repository.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Skill {
    pub(crate) place: Place,
    /// The content of its `SKILL.md`.
    pub(crate) text: String,
    /// Every file in the skill directory, relative to it (symbolic-link folders followed).
    pub(crate) files: Vec<PathBuf>,
    /// Where the folder really is, when it is a symbolic link.
    pub(crate) link: Option<Link>,
}

/// The real directory of a symbolic-link skill folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Link {
    /// Relative to the repository root.
    Inside(PathBuf),
    /// Outside the repository.
    Outside,
}

/// A skill root outside the repository and the skills it holds.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct OutsideRoot {
    /// Absolute path of the root directory.
    pub(crate) path: PathBuf,
    /// Names of the skill directories in it, sorted.
    pub(crate) skills: Vec<String>,
}

/// What the user-scope probes see.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub(crate) struct User {
    pub(crate) home: Option<PathBuf>,
    /// Skill roots in the parent directories and the home directory, nearest first.
    pub(crate) roots: Vec<OutsideRoot>,
}

/// What the probes see of a repository.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub(crate) struct Snapshot {
    /// Every skill, sorted by place.
    pub(crate) skills: Vec<Skill>,
    /// Every file in the repository, relative to the root, sorted.
    pub(crate) files: Vec<PathBuf>,
    /// `None` when the run is repository-only.
    pub(crate) user: Option<User>,
}

pub(crate) fn read(root: &Path, reach: Reach) -> Result<Snapshot, Error> {
    fs::require_dir(root)?;
    let walked = fs::project_files(root)?;
    let mut files = root_dirs(&walked)
        .into_iter()
        .map(|dir| root_files(root, &dir))
        .collect::<Result<Vec<_>, _>>()?
        .concat();
    files.extend(walked);
    files.sort();
    files.dedup();
    Ok(Snapshot {
        skills: skills(root, &files)?,
        user: reach
            .includes_user_scope()
            .then(|| user(root))
            .transpose()?,
        files,
    })
}

/// Every skill root the walk can miss, relative to the repository root: the four at the
/// root, each root the walk crossed, and each root behind a symbolic link (`.claude`, or
/// `.claude/skills` itself). Both agents read a skill root whole, ignore rules or not.
fn root_dirs(walked: &[PathBuf]) -> BTreeSet<PathBuf> {
    let crossed = walked.iter().flat_map(|path| {
        let linked =
            path.file_name()
                .and_then(|name| name.to_str())
                .map_or_else(Vec::new, |name| {
                    let scope = path.parent().unwrap_or_else(|| Path::new(""));
                    Root::ALL
                        .into_iter()
                        .filter(|root| root.path().split('/').next() == Some(name))
                        .map(|root| scope.join(root.path()))
                        .collect()
                });
        locate(path)
            .map(|found| found.root_dir())
            .into_iter()
            .chain(linked)
    });
    Root::ALL
        .into_iter()
        .map(|root| PathBuf::from(root.path()))
        .chain(crossed)
        .collect()
}

/// The files of the skill root `dir`, relative to the repository root; none when it is
/// not a directory.
fn root_files(root: &Path, dir: &Path) -> Result<Vec<PathBuf>, Error> {
    let on_disk = root.join(dir);
    if !fs::exists(&on_disk.join("."))? {
        return Ok(Vec::new());
    }
    Ok(fs::tree_files(&on_disk)?
        .into_iter()
        .map(|file| dir.join(file))
        .collect())
}

fn skills(root: &Path, files: &[PathBuf]) -> Result<Vec<Skill>, Error> {
    let mut places = files
        .iter()
        .map(|path| skill_place(root, path))
        .filter_map(Result::transpose)
        .collect::<Result<Vec<_>, _>>()?;
    places.sort();
    places.dedup();
    places
        .into_iter()
        .map(|place| skill(root, place, files))
        .filter_map(Result::transpose)
        .collect()
}

/// The skill that `path` makes: its `SKILL.md`, or a symbolic-link folder holding one.
fn skill_place(root: &Path, path: &Path) -> Result<Option<Place>, Error> {
    let Some((place, found)) = place(path) else {
        return Ok(None);
    };
    let made = match found {
        Shape::SkillMd => true,
        Shape::Folder => linked_skill(&root.join(path))?,
    };
    Ok(made.then_some(place))
}

/// Whether `dir` is a symbolic link to a folder that holds `SKILL.md`.
fn linked_skill(dir: &Path) -> Result<bool, Error> {
    Ok(fs::link_target(dir)?.is_some() && fs::exists(&dir.join(SKILL_MD))?)
}

fn skill(root: &Path, place: Place, listed: &[PathBuf]) -> Result<Option<Skill>, Error> {
    let dir = root.join(place.dir());
    let Some(text) = fs::read_optional(&dir.join(SKILL_MD))? else {
        return Ok(None);
    };
    let link = fs::link_target(&dir)?
        .map(|_| real(root, &dir))
        .transpose()?;
    // The walk lists a linked folder as one entry; only a plain folder's files are in it.
    let mut files = if link.is_some() {
        fs::tree_files(&dir)?
    } else {
        let prefix = place.dir();
        listed
            .iter()
            .filter_map(|file| file.strip_prefix(&prefix).ok())
            .map(Path::to_path_buf)
            .collect()
    };
    files.sort();
    Ok(Some(Skill {
        place,
        text,
        files,
        link,
    }))
}

/// Where the linked folder `dir` really is.
fn real(root: &Path, dir: &Path) -> Result<Link, Error> {
    let target = fs::canonical(dir)?;
    let base = fs::canonical(root)?;
    Ok(target
        .strip_prefix(&base)
        .map_or(Link::Outside, |inside| Link::Inside(inside.to_path_buf())))
}
fn user(root: &Path) -> Result<User, Error> {
    // `$HOME` may be a symbolic link; the parent walk is resolved, so resolve it too.
    let home = fs::home_dir().map(|home| fs::canonical(&home).unwrap_or(home));
    let parents = fs::parent_dirs(root)?
        .into_iter()
        .flat_map(|dir| SKILL_ROOTS.iter().map(move |name| dir.join(name)));
    let personal = home
        .iter()
        .flat_map(|home| HOME_ROOTS.iter().map(move |name| home.join(name)));
    let candidates = parents.chain(personal).fold(Vec::new(), |mut seen, path| {
        if !seen.contains(&path) {
            seen.push(path);
        }
        seen
    });
    let roots = candidates
        .into_iter()
        .map(outside_root)
        .filter_map(Result::transpose)
        .collect::<Result<_, _>>()?;
    Ok(User { home, roots })
}

fn outside_root(path: PathBuf) -> Result<Option<OutsideRoot>, Error> {
    if !fs::exists(&path)? {
        return Ok(None);
    }
    let mut skills = fs::tree_files(&path)?
        .into_iter()
        .filter_map(|file| skill_name(&path, &file).transpose())
        .collect::<Result<Vec<_>, _>>()?;
    skills.sort();
    skills.dedup();
    Ok((!skills.is_empty()).then_some(OutsideRoot { path, skills }))
}

/// The skill name that `file` (relative to the root `dir`) makes; `None` for a path that
/// is not UTF-8.
fn skill_name(dir: &Path, file: &Path) -> Result<Option<String>, Error> {
    let Some(parts) = file
        .iter()
        .map(|part| part.to_str())
        .collect::<Option<Vec<&str>>>()
    else {
        return Ok(None);
    };
    let Some((name, found)) = shape(&parts) else {
        return Ok(None);
    };
    let made = match found {
        Shape::SkillMd => true,
        Shape::Folder => linked_skill(&dir.join(name))?,
    };
    Ok(made.then(|| name.to_owned()))
}
