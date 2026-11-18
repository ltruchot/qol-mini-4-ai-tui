//! Markdown read line by line, as agents load it: pure, no I/O.
//!
//! This is not a `CommonMark` parser. It tells fenced code blocks (```` ``` ```` or `~~~`)
//! and block-level HTML comments (a line that opens with `<!--`, up to the line that holds
//! `-->`) apart from prose, which is enough for the gates: Claude Code strips block-level
//! comments before injecting an instruction file and keeps code blocks (memory docs), and
//! paths and links inside code are examples, not references.

use std::path::{Component, Path, PathBuf};

/// Where a line sits.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Region {
    /// Ordinary Markdown.
    Prose,
    /// A fenced code block, fences included.
    Code,
    /// A block-level HTML comment.
    Comment,
}

/// One line of a Markdown text, numbered from 1.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Line<'a> {
    /// The line number, from 1.
    pub number: usize,
    /// The line, without its line break.
    pub text: &'a str,
    /// Where the line sits.
    pub region: Region,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum State {
    Prose,
    /// Inside a fenced block opened by `len` copies of `mark`.
    Fence {
        mark: char,
        len: usize,
    },
    Comment,
}

/// Every line of `text` with its region.
pub fn lines(text: &str) -> impl Iterator<Item = Line<'_>> {
    text.lines()
        .zip(1_usize..)
        .scan(State::Prose, |state, (line, number)| {
            let (region, next) = step(*state, line.trim_start());
            *state = next;
            Some(Line {
                number,
                text: line,
                region,
            })
        })
}

/// The fence that opens `line`: its character and length, three or more.
fn fence(line: &str) -> Option<(char, usize)> {
    let mark = line.chars().next().filter(|c| *c == '`' || *c == '~')?;
    let len = line.chars().take_while(|c| *c == mark).count();
    (len >= 3).then_some((mark, len))
}

fn step(state: State, line: &str) -> (Region, State) {
    let opened = fence(line);
    match state {
        // `CommonMark`: a closing fence uses the same character, at least as many times,
        // and nothing but spaces after it.
        State::Fence { mark, len } => {
            let closes = opened.is_some_and(|(other, count)| {
                other == mark && count >= len && line.trim_start_matches(mark).trim().is_empty()
            });
            (Region::Code, if closes { State::Prose } else { state })
        }
        State::Comment => (Region::Comment, comment_state(line.contains("-->"))),
        State::Prose if opened.is_some() => {
            let (mark, len) = opened.unwrap_or(('`', 3));
            (Region::Code, State::Fence { mark, len })
        }
        State::Prose if line.starts_with("<!--") => {
            let rest = line.get(4..).unwrap_or_default();
            (Region::Comment, comment_state(rest.contains("-->")))
        }
        State::Prose => (Region::Prose, State::Prose),
    }
}

const fn comment_state(closed: bool) -> State {
    if closed { State::Prose } else { State::Comment }
}

/// The prose lines of `text`: outside fenced code and block-level comments.
pub fn prose(text: &str) -> impl Iterator<Item = Line<'_>> {
    lines(text).filter(|line| line.region == Region::Prose)
}

/// `text` as Claude Code injects it: block-level HTML comments removed. Returns the text
/// unchanged when it holds none.
#[must_use]
pub fn without_comments(text: &str) -> String {
    if lines(text).all(|line| line.region != Region::Comment) {
        return text.to_owned();
    }
    let kept: Vec<&str> = lines(text)
        .filter(|line| line.region != Region::Comment)
        .map(|line| line.text)
        .collect();
    let mut out = kept.join("\n");
    if text.ends_with('\n') && !out.is_empty() {
        out.push('\n');
    }
    out
}

/// The parts of `line` outside inline code spans.
pub fn outside_code(line: &str) -> impl Iterator<Item = &str> {
    line.split('`').step_by(2)
}

/// The inline code spans of `line`, without their backticks.
pub fn code_spans(line: &str) -> impl Iterator<Item = &str> {
    line.split('`').skip(1).step_by(2)
}

/// The local targets of every Markdown link outside code, inline (`[text](target)`) or a
/// reference definition (`[label]: target`), with any `#fragment` or `?query` removed and
/// `%XX` escapes decoded, in file order.
#[must_use]
pub fn link_targets(markdown: &str) -> Vec<String> {
    links(markdown)
        .into_iter()
        .map(|(_, target)| target)
        .collect()
}

/// [`link_targets`], each with the number of its line.
#[must_use]
pub fn links(markdown: &str) -> Vec<(usize, String)> {
    prose(markdown)
        .flat_map(|line| {
            definition(line.text)
                .into_iter()
                .chain(outside_code(line.text).flat_map(links_in))
                .filter_map(local)
                .map(move |target| (line.number, target))
        })
        .collect()
}

/// Inline link targets: from `](` to the `)` that balances it, so `rfc(1).md` stays whole.
fn links_in(text: &str) -> impl Iterator<Item = &str> {
    text.match_indices("](").filter_map(move |(at, _)| {
        let after = text.get(at.saturating_add(2)..)?;
        after.get(..closing(after)?)
    })
}

/// The index of the `)` that closes a link target opened just before `text`.
fn closing(text: &str) -> Option<usize> {
    let mut depth = 0_usize;
    for (index, c) in text.char_indices() {
        match c {
            ')' if depth == 0 => return Some(index),
            ')' => depth = depth.saturating_sub(1),
            '(' => depth = depth.saturating_add(1),
            _ => {}
        }
    }
    None
}

/// The target of a reference definition, `[label]: target` indented at most three spaces.
fn definition(line: &str) -> Option<&str> {
    let indent = line
        .len()
        .saturating_sub(line.trim_start_matches(' ').len());
    let rest = line.trim_start_matches(' ').strip_prefix('[')?;
    let (label, after) = rest.split_once("]:")?;
    (indent <= 3 && !label.is_empty() && !label.starts_with('^')).then_some(after)
}

/// The path part of a link target when it is a local, relative path.
fn local(target: &str) -> Option<String> {
    let target = target.trim();
    let path = target.strip_prefix('<').map_or_else(
        || target.split_whitespace().next().unwrap_or_default(),
        |inner| inner.split('>').next().unwrap_or_default(),
    );
    let path = path.split(['#', '?']).next().unwrap_or_default();
    let remote = path.contains("://") || path.starts_with("mailto:") || path.starts_with('/');
    (!path.is_empty() && !remote).then(|| decoded(path))
}

/// `path` with its `%XX` escapes decoded; unchanged when the result is not UTF-8.
fn decoded(path: &str) -> String {
    let bytes = path.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while let Some(&byte) = bytes.get(index) {
        let escape = (byte == b'%')
            .then(|| path.get(index.saturating_add(1)..index.saturating_add(3)))
            .flatten()
            .and_then(|hex| u8::from_str_radix(hex, 16).ok());
        if let Some(value) = escape {
            out.push(value);
            index = index.saturating_add(3);
        } else {
            out.push(byte);
            index = index.saturating_add(1);
        }
    }
    String::from_utf8(out).unwrap_or_else(|_| path.to_owned())
}

/// `target` resolved from `dir`, both relative to the repository root, without touching
/// the disk; `None` when it climbs out of the repository.
#[must_use]
pub fn resolve(dir: &Path, target: &str) -> Option<PathBuf> {
    dir.join(target)
        .components()
        .try_fold(PathBuf::new(), |path, part| match part {
            Component::Normal(name) => Some(path.join(name)),
            Component::ParentDir => path.parent().map(Path::to_path_buf),
            Component::CurDir | Component::RootDir | Component::Prefix(_) => Some(path),
        })
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{Region, code_spans, lines, link_targets, links, prose, resolve, without_comments};
    use std::path::{Path, PathBuf};

    fn regions(text: &str) -> Vec<Region> {
        lines(text).map(|line| line.region).collect()
    }

    #[test]
    fn targets_keep_local_links_outside_code() {
        let markdown = "See [the guide](references/guide.md#setup) and [api](<api.md> \"API\").\n\
             Run `[not](a-link.md)` or [web](https://example.com), [mail](mailto:x), [top](#top).\n\
             ```md\n[example](missing.md)\n```\n\
             [abs](/etc/passwd) [query](scripts/run.sh?x=1) [empty]()\n";
        assert_eq!(
            link_targets(markdown),
            ["references/guide.md", "api.md", "scripts/run.sh"]
        );
    }

    #[test]
    fn targets_balance_parentheses_decode_escapes_and_read_definitions() {
        let markdown = "[spec](docs/rfc(1).md) and [notes](my%20notes.md) (see [x](a.md)).\n\
             [ref]: references/missing.md \"Title\"\n   [two]: <two words.md>\n\
             [^note]: a footnote\n    [code]: indented.md\n`[span]: in-code.md`\n\
             [bad](%ff.md)\n";
        assert_eq!(
            link_targets(markdown),
            [
                "docs/rfc(1).md",
                "my notes.md",
                "a.md",
                "references/missing.md",
                "two words.md",
                "%ff.md",
            ]
        );
        assert_eq!(links("x\n[r]: b.md\n"), [(2, "b.md".to_owned())]);
    }

    #[test]
    fn a_fence_closes_only_on_its_own_kind_and_length() {
        let text = "````md\n```\n[ex](docs/example.md)\n```\n````\n[after](a.md)\n\
                    ~~~\n```\n[in](b.md)\n~~~\n```js\n``` not a close\n[c](c.md)\n```\n";
        assert_eq!(link_targets(text), ["a.md"]);
    }

    #[test]
    fn tilde_fences_hide_links_too() {
        assert_eq!(link_targets("~~~\n[x](y.md)\n~~~\n"), Vec::<String>::new());
        assert_eq!(link_targets("~~~\n~~~\n[x](y.md)\n"), ["y.md"]);
    }

    #[test]
    fn resolve_normalizes_and_stays_in_the_repository() {
        let dir = Path::new(".claude/skills/deploy");
        assert_eq!(
            resolve(dir, "./references/../SKILL.md"),
            Some(PathBuf::from(".claude/skills/deploy/SKILL.md"))
        );
        assert_eq!(
            resolve(dir, "../../../docs/a.md"),
            Some(PathBuf::from("docs/a.md"))
        );
        assert_eq!(resolve(dir, "../../../../outside.md"), None);
    }

    #[test]
    fn fences_and_block_comments_are_their_own_regions() {
        let text =
            "a\n```\n<!-- kept -->\n```\n<!-- one line -->\n  <!-- opens\nstill\nends -->\nb\n";
        assert_eq!(
            regions(text),
            [
                Region::Prose,
                Region::Code,
                Region::Code,
                Region::Code,
                Region::Comment,
                Region::Comment,
                Region::Comment,
                Region::Comment,
                Region::Prose,
            ]
        );
        let numbers: Vec<usize> = prose(text).map(|line| line.number).collect();
        assert_eq!(numbers, [1, 9]);
    }

    #[test]
    fn an_inline_comment_is_prose() {
        assert_eq!(regions("text <!-- note --> more\n"), [Region::Prose]);
    }

    #[test]
    fn without_comments_drops_only_block_comments() {
        assert_eq!(without_comments("a\n<!-- x -->\nb\n"), "a\nb\n");
        assert_eq!(without_comments("a\n<!-- x\ny -->\nb"), "a\nb");
        assert_eq!(without_comments("<!-- x -->\n"), "");
        let plain = "a\n```\n<!-- code -->\n```\n";
        assert_eq!(without_comments(plain), plain);
    }

    #[test]
    fn code_spans_are_the_odd_parts() {
        let spans: Vec<&str> = code_spans("run `cargo test` then `cargo doc`").collect();
        assert_eq!(spans, ["cargo test", "cargo doc"]);
        assert_eq!(code_spans("no code").count(), 0);
        assert_eq!(
            links("a\n[x](y.md) [z](w.md)\n"),
            [(2, "y.md".to_owned()), (2, "w.md".to_owned())]
        );
    }
}
