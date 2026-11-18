//! The `instructions` array of `opencode.json[c]`: pure, no I/O.
//!
//! `OpenCode` 2 (`config/plugin/instruction.ts` at `d759c548aa`) reads each entry as a path
//! or a glob, relative patterns searched from the working directory up to the project root,
//! `~/` from the home directory, and `http(s)` entries as URLs. This reads the array with a
//! string scanner, not a JSON parser: the entries are plain strings.

use std::path::Path;

use globset::GlobBuilder;

/// The string entries of the first `"instructions"` array in `config`.
pub(crate) fn instructions(config: &str) -> Vec<String> {
    let Some(at) = config.find("\"instructions\"") else {
        return Vec::new();
    };
    let after = config
        .get(at.saturating_add("\"instructions\"".len())..)
        .unwrap_or_default();
    let Some(open) = after.trim_start().strip_prefix(':') else {
        return Vec::new();
    };
    let Some(body) = open.trim_start().strip_prefix('[') else {
        return Vec::new();
    };
    strings(body)
}

/// The quoted strings of an array body, up to its closing `]`.
fn strings(body: &str) -> Vec<String> {
    let mut found = Vec::new();
    let mut chars = body.chars();
    while let Some(c) = chars.next() {
        match c {
            ']' => break,
            '"' => found.push(string(&mut chars)),
            _ => {}
        }
    }
    found
}

/// One JSON string after its opening quote, with `\"` and `\\` unescaped.
fn string(chars: &mut impl Iterator<Item = char>) -> String {
    let mut text = String::new();
    while let Some(c) = chars.next() {
        match c {
            '"' => break,
            '\\' => text.extend(chars.next()),
            _ => text.push(c),
        }
    }
    text
}

/// Whether an entry of the `instructions` array in `config` loads `path`, relative to the
/// repository root.
pub(crate) fn lists(config: &str, path: &Path) -> bool {
    instructions(config)
        .iter()
        .any(|entry| matches(entry, path))
}

fn matches(entry: &str, path: &Path) -> bool {
    if entry.starts_with("~/") || entry.contains("://") {
        return false;
    }
    let pattern = entry.strip_prefix("./").unwrap_or(entry);
    GlobBuilder::new(pattern)
        .literal_separator(true)
        .build()
        .is_ok_and(|glob| glob.compile_matcher().is_match(path))
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{instructions, lists};
    use std::path::Path;

    #[test]
    fn instructions_reads_the_array_strings() {
        let config = "{\n  // a comment\n  \"$schema\": \"x\",\n  \"instructions\": [\n    \
                      \"docs/*.md\", \"./RULES.md\", \"a\\\"b\"\n  ],\n  \"other\": [\"no\"]\n}";
        assert_eq!(instructions(config), ["docs/*.md", "./RULES.md", "a\"b"]);
        assert_eq!(instructions("{}"), Vec::<String>::new());
        assert_eq!(instructions("{\"instructions\": 3}"), Vec::<String>::new());
        assert_eq!(instructions("{\"instructions\" []}"), Vec::<String>::new());
    }

    #[test]
    fn lists_matches_paths_and_globs_only_in_the_array() {
        let config = "{\"instructions\": [\"docs/*.md\", \"./RULES.md\", \"~/x.md\", \
                      \"https://e.com/a.md\", \"[\"], \"note\": \"lib/a.md\"}";
        assert!(lists(config, Path::new("docs/style.md")));
        assert!(!lists(config, Path::new("docs/deep/style.md")));
        assert!(lists(config, Path::new("RULES.md")));
        assert!(!lists(config, Path::new("lib/a.md")));
        assert!(!lists(config, Path::new("x.md")));
    }
}
