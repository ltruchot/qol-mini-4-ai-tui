//! The `skills` gate (ADR 4): deterministic probes on a repository's `SKILL.md` files.
//!
//! - [`audit`] reads the repository once (the `snapshot` boundary), then runs every probe as
//!   a pure function of that snapshot: where skills live and which agent loads them
//!   (`SK01`–`SK05`), each skill's frontmatter, size, and links (`SK06`–`SK12`), the
//!   inventory (`SK13`), and, in user scope, the skill roots outside the repository
//!   (`SK14`–`SK15`).
//! - The non-deterministic half of the gate is the `skills-review` skill shipped in
//!   `skills/`: it runs this binary first, then reviews the content.
#![cfg_attr(all(coverage_nightly, test), feature(coverage_attribute))]

mod content;
mod layout;
mod probes;
mod snapshot;
mod tree;
mod user;

use std::path::Path;

use vitals_utils::{Error, Report};

pub use probes::{DESCRIPTION, GATE, LINE_LIMIT};
pub use vitals_utils::Reach;

/// Runs every probe of the `skills` gate on the repository at `root`, as far as `reach`.
///
/// # Errors
///
/// Returns an [`Error`] when `root` is not a readable directory or a `SKILL.md` exists but
/// cannot be read as UTF-8 text.
pub fn audit(root: &Path, reach: Reach) -> Result<Report, Error> {
    snapshot::read(root, reach).map(|snapshot| probes::check(&snapshot))
}
