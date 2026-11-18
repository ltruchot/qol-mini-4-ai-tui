//! The `agents-md` gate (ADR 4): deterministic probes on a repository's rules file.
//!
//! - [`audit`] reads the repository once (the `snapshot` boundary), then runs every probe as
//!   a pure function of that snapshot: the root files (`AM01`–`AM08`), the nested cascade
//!   (`AM09`–`AM13`), in user scope the parent directories (`AM14`–`AM15`) and the managed
//!   `CLAUDE.md` (`AM21`), and what the instruction files say: imports, structure, emphasis,
//!   references (`AM16`–`AM19`), and the `paths` of rules (`AM20`).
//! - The non-deterministic half of the gate is the `agents-md-review` skill shipped in
//!   `skills/`: it runs this binary first, then reviews the content.
#![cfg_attr(all(coverage_nightly, test), feature(coverage_attribute))]

mod ancestors;
mod cascade;
mod content;
mod imports;
mod nested;
mod opencode;
mod probes;
mod rules;
mod snapshot;

use std::path::Path;

use vitals_utils::{Error, Report};

pub use content::{BLOCK_CHARS, EMPHASIS_BUDGET, HEADING_FLOOR};
pub use imports::HOPS;
pub use probes::{ATTACHED_CHARS, GATE, HANDOFF_WINDOW, LAUNCH_BYTES, LINES, ON_DEMAND_CHARS};
pub use vitals_utils::Reach;

/// Runs every probe of the `agents-md` gate on the repository at `root`, as far as `reach`.
///
/// # Errors
///
/// Returns an [`Error`] when `root` is not a readable directory or a rules file exists but
/// cannot be read as UTF-8 text.
pub fn audit(root: &Path, reach: Reach) -> Result<Report, Error> {
    snapshot::read(root, reach).map(|snapshot| probes::check(&snapshot))
}
