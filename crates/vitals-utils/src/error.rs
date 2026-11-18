//! Errors raised at the filesystem boundary, and their rendering.

use std::path::PathBuf;

/// Why a gate could not read the repository.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// A path exists, or may exist, but could not be read.
    #[error("cannot read {}", path.display())]
    Read {
        /// The path that failed.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },
    /// The repository tree could not be walked.
    #[error("cannot walk the repository")]
    Walk(#[from] ignore::Error),
    /// The repository root is not a directory.
    #[error("{} is not a directory", path.display())]
    NotADirectory {
        /// The path given as the repository root.
        path: PathBuf,
    },
}

/// Renders an error and every source below it on one line, outermost first.
///
/// # Examples
///
/// ```
/// let missing = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "denied");
/// let error = vitals_utils::Error::Read { path: "AGENTS.md".into(), source: missing };
/// assert_eq!(vitals_utils::report(&error), "cannot read AGENTS.md: denied");
/// ```
#[must_use]
pub fn report(error: &dyn std::error::Error) -> String {
    core::iter::successors(Some(error), |current| current.source())
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join(": ")
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{Error, report};

    #[test]
    fn report_renders_a_leaf_error_alone() {
        let error = Error::NotADirectory {
            path: "repo".into(),
        };
        assert_eq!(report(&error), "repo is not a directory");
    }
}
