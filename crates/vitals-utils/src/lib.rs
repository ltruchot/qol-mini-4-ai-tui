//! Building blocks shared by every qol-mini vitals gate (ADR 0008).
//!
//! Only code that two or more gates need lives here. Everything is pure except [`fs`],
//! the filesystem boundary.
//!
//! - [`Finding`], [`Verdict`], [`Report`], [`Outcome`]: what probes conclude and how a gate
//!   binary reports it and exits; [`Reach`]: whether a run reads the user scope.
//! - [`TextSize`], [`Budget`]: line and char budgets for instruction files and skills.
//! - [`markers`]: the paths that agents read, shared across gates.
//! - [`markdown`]: Markdown regions (prose, code, comments), code spans, and links;
//!   [`frontmatter`]: the YAML block that opens a Markdown file.
//! - [`fs`]: optional file reads, existence, symlink targets, the project walk, the parent
//!   directories, and the home directory.
#![cfg_attr(all(coverage_nightly, test), feature(coverage_attribute))]

mod error;
mod finding;
pub mod frontmatter;
pub mod fs;
pub mod markdown;
pub mod markers;
mod text;

pub use error::{Error, report};
pub use finding::{Finding, Outcome, Reach, Report, Scope, Verdict, or_pass};
pub use text::{Budget, TextSize};
