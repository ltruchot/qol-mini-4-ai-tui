//! The YAML frontmatter of a Markdown file (`SKILL.md`, a `.claude/rules` file), read by a
//! line scanner: pure, no I/O.
//!
//! This is not a YAML parser (ADR 4, "The skills gate"). It finds the top-level keys of the
//! block between the opening `---` (first line) and the closing `---`, reads each key's
//! scalar value (plain, quoted, or block) or sequence of scalars, and flags the plain-value
//! mistakes that YAML rejects: a `: ` on any line of the value, and a value that opens with
//! a reserved indicator or a flow collection followed by text. Claude Code then loads
//! a skill with no fields; `OpenCode` (`config/markdown.ts`) retries values that contain
//! `:` or start with `[x] text` as block scalars, and skips the skill otherwise.

/// What a top-level key holds.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Value {
    /// A string scalar.
    Text(String),
    /// No value: YAML null.
    Empty,
    /// A sequence (`[a, b]`, or `- a` lines), with its scalar items unquoted.
    List(Vec<String>),
    /// A map.
    Collection,
}

impl Value {
    /// Whether the value is a list or a map, which neither agent reads as a string.
    #[must_use]
    pub const fn is_collection(&self) -> bool {
        matches!(self, Self::List(_) | Self::Collection)
    }
}

/// Why YAML rejects a plain value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mistake {
    /// `: ` inside the value, or a trailing `:`: `OpenCode` repairs it.
    Colon,
    /// `[x] text`: `OpenCode` repairs it.
    TaggedText,
    /// Opens with an indicator that cannot start a plain value: `` ` `` or `@` (reserved),
    /// `*` (an alias), `!` (a tag), or `%` (a directive). `OpenCode` repairs it only when
    /// the value also holds a `:`.
    Reserved {
        /// Whether the value also holds a `:`, so that `OpenCode` repairs it.
        repaired: bool,
    },
}

impl Mistake {
    /// Whether `OpenCode`'s retry turns the value back into a string.
    #[must_use]
    pub const fn repaired(self) -> bool {
        match self {
            Self::Colon | Self::TaggedText => true,
            Self::Reserved { repaired } => repaired,
        }
    }

    /// What is wrong, for a finding message.
    #[must_use]
    pub const fn reason(self) -> &'static str {
        match self {
            Self::Colon => "holds an unquoted `: `",
            Self::TaggedText => "opens with `[...]` followed by text",
            Self::Reserved { .. } => {
                "opens with `` ` ``, `@`, `*`, `!`, or `%`, which YAML does not read as text"
            }
        }
    }
}

/// One top-level key.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Field {
    /// The key.
    pub key: String,
    /// What it holds.
    pub value: Value,
    /// The key's line in the file, from 1.
    pub line: usize,
    /// The YAML mistake in a plain value, if any.
    pub mistake: Option<Mistake>,
}

/// The frontmatter of a Markdown file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Frontmatter {
    /// The first line is not `---`.
    Missing,
    /// The first line is `---` and no later line closes the block.
    Unclosed,
    /// The fields, in file order.
    Fields(Vec<Field>),
}

impl Frontmatter {
    /// The field `key`, when the block has it.
    #[must_use]
    pub fn field(&self, key: &str) -> Option<&Field> {
        match self {
            Self::Fields(fields) => fields.iter().find(|field| field.key == key),
            Self::Missing | Self::Unclosed => None,
        }
    }

    /// The first field whose value YAML rejects; `None` when every value parses, or when
    /// there is no block to read.
    #[must_use]
    pub fn first_mistake(&self) -> Option<&Field> {
        match self {
            Self::Fields(fields) => fields.iter().find(|field| field.mistake.is_some()),
            Self::Missing | Self::Unclosed => None,
        }
    }

    /// The string value of `key`, trimmed; `None` when absent, empty, or not a string.
    #[must_use]
    pub fn text(&self, key: &str) -> Option<&str> {
        self.field(key).and_then(|field| match &field.value {
            Value::Text(text) => Some(text.trim()).filter(|text| !text.is_empty()),
            Value::Empty | Value::List(_) | Value::Collection => None,
        })
    }

    /// The items of `key`: a sequence's items, or a string split on the commas outside
    /// quotes and `{...}` groups (`src/**/*.{ts,tsx}` stays whole), each trimmed and
    /// non-empty; `None` when absent, empty, or a map.
    pub fn items(&self, key: &str) -> Option<Vec<String>> {
        let items: Vec<String> = match &self.field(key)?.value {
            Value::List(items) => items.clone(),
            Value::Text(text) => split_items(text).into_iter().map(str::to_owned).collect(),
            Value::Empty | Value::Collection => return None,
        };
        let kept: Vec<String> = items
            .iter()
            .map(|item| item.trim().to_owned())
            .filter(|item| !item.is_empty())
            .collect();
        (!kept.is_empty()).then_some(kept)
    }

    /// Whether `key` is a true boolean, as both agents read one (`true`, `yes`, `on`, `1`,
    /// in any letter case).
    #[must_use]
    pub fn is_true(&self, key: &str) -> bool {
        self.text(key).is_some_and(|text| {
            ["true", "yes", "on", "1"]
                .iter()
                .any(|truth| text.eq_ignore_ascii_case(truth))
        })
    }
}

const FENCE: &str = "---";

/// Reads the frontmatter of `text`.
pub fn read(text: &str) -> Frontmatter {
    let mut lines = text.lines();
    if lines.next().map(str::trim_end) != Some(FENCE) {
        return Frontmatter::Missing;
    }
    let block: Vec<&str> = lines
        .by_ref()
        .take_while(|line| line.trim_end() != FENCE)
        .collect();
    // `take_while` consumed the closing fence when there was one; the block then ends
    // before the end of the text.
    let closed = text.lines().skip(1).any(|line| line.trim_end() == FENCE);
    if closed {
        Frontmatter::Fields(entries(&block).iter().map(Entry::field).collect())
    } else {
        Frontmatter::Unclosed
    }
}

/// A top-level key line and the lines that continue its value.
struct Entry<'a> {
    line: usize,
    key: &'a str,
    inline: &'a str,
    rest: Vec<&'a str>,
}

fn entries<'a>(block: &[&'a str]) -> Vec<Entry<'a>> {
    block
        .iter()
        .enumerate()
        .fold(Vec::new(), |mut found, (index, line)| {
            if let Some((key, inline)) = key_line(line) {
                found.push(Entry {
                    // The block starts on the file's second line.
                    line: index.saturating_add(2),
                    key,
                    inline,
                    rest: Vec::new(),
                });
            } else if let Some(last) = found.last_mut() {
                last.rest.push(line);
            }
            found
        })
}

/// `key: value` at column 0: a key of letters, digits, `_`, or `-`, then `:` and a space or
/// the end of the line.
fn key_line(line: &str) -> Option<(&str, &str)> {
    let (key, after) = line.split_once(':')?;
    let is_key = !key.is_empty()
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    let separated = after.is_empty() || after.starts_with([' ', '\t']);
    (is_key && separated).then(|| (key, after.trim()))
}

impl Entry<'_> {
    fn field(&self) -> Field {
        let (value, mistake) = self.value();
        Field {
            key: self.key.to_owned(),
            value,
            line: self.line,
            mistake,
        }
    }

    fn continuation(&self) -> impl Iterator<Item = &str> {
        self.rest
            .iter()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
    }

    fn value(&self) -> (Value, Option<Mistake>) {
        let inline = self.inline;
        if inline.is_empty() || inline.starts_with('#') {
            return (self.nested(), None);
        }
        if inline.starts_with(['|', '>']) {
            return (Value::Text(self.block(inline)), None);
        }
        // A quoted scalar may span lines, and `#` inside it is text, not a comment.
        let spanned = core::iter::once(inline)
            .chain(self.rest.iter().map(|line| line.trim()))
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join(" ");
        if let Some(quoted) = quoted(&spanned) {
            return (Value::Text(quoted), None);
        }
        if inline.starts_with(['[', '{']) {
            return flow(inline);
        }
        let text = core::iter::once(inline)
            .chain(self.continuation())
            .map(plain)
            .collect::<Vec<_>>()
            .join(" ");
        let mistake = plain_mistake(&text);
        (Value::Text(text), mistake)
    }

    /// A block scalar: its lines indented below the key, the common indentation removed;
    /// `|` keeps line breaks, `>` folds them into spaces. Blank lines and lines that start
    /// with `#` are content.
    fn block(&self, indicator: &str) -> String {
        let lines: Vec<&str> = self
            .rest
            .iter()
            .take_while(|line| line.trim().is_empty() || line.starts_with([' ', '\t']))
            .copied()
            .collect();
        let indent = lines
            .iter()
            .filter(|line| !line.trim().is_empty())
            .map(|line| line.len().saturating_sub(line.trim_start().len()))
            .min()
            .unwrap_or(0);
        let body = lines
            .iter()
            .map(|line| line.get(indent..).unwrap_or_default().trim_end());
        let text = if indicator.starts_with('|') {
            body.collect::<Vec<_>>().join("\n")
        } else {
            fold(body)
        };
        text.trim_end().to_owned()
    }

    /// A value on the lines below the key: a list, a map, or a multi-line plain scalar.
    fn nested(&self) -> Value {
        let lines: Vec<&str> = self.continuation().collect();
        match lines.first() {
            None => Value::Empty,
            Some(first) if first.starts_with('-') => Value::List(
                lines
                    .iter()
                    .filter_map(|line| line.strip_prefix('-'))
                    .map(|item| unquote(item.trim()))
                    .collect(),
            ),
            Some(first) if key_line(first).is_some() => Value::Collection,
            Some(_) => Value::Text(lines.join(" ")),
        }
    }
}

/// Folded lines: joined by spaces, a blank line kept as a line break.
fn fold<'a>(lines: impl Iterator<Item = &'a str>) -> String {
    lines
        .map(|line| if line.is_empty() { "\n" } else { line })
        .collect::<Vec<_>>()
        .join(" ")
        .replace(" \n ", "\n")
}

/// A single- or double-quoted scalar, unescaped, up to its closing quote: what follows
/// it (a ` # comment`) is not part of it. An unclosed quote runs to the end of `text`.
fn quoted(text: &str) -> Option<String> {
    let quote = text.chars().next().filter(|c| *c == '"' || *c == '\'')?;
    let mut chars = text.get(1..)?.chars().peekable();
    let mut body = String::new();
    while let Some(c) = chars.next() {
        match (quote, c) {
            ('"', '\\') => body.extend(chars.next()),
            ('\'', '\'') if chars.peek() == Some(&'\'') => {
                body.push('\'');
                chars.next();
            }
            _ if c == quote => break,
            _ => body.push(c),
        }
    }
    Some(body)
}

/// `[a, b]` or `{a: b}` is a collection; `[Tag] text` is a YAML error that `OpenCode`
/// repairs into a string.
fn flow(inline: &str) -> (Value, Option<Mistake>) {
    let close = inline.rfind([']', '}']);
    let trailing = close
        .and_then(|at| inline.get(at.saturating_add(1)..))
        .is_some_and(|after| !after.trim().is_empty() && !after.trim().starts_with('#'));
    if trailing {
        (Value::Text(inline.to_owned()), Some(Mistake::TaggedText))
    } else if let Some(inner) = inline
        .strip_prefix('[')
        .and_then(|rest| close.and_then(|at| rest.get(..at.saturating_sub(1))))
    {
        let items = split_items(inner)
            .into_iter()
            .map(|item| unquote(item.trim()))
            .filter(|item| !item.is_empty())
            .collect();
        (Value::List(items), None)
    } else {
        (Value::Collection, None)
    }
}

/// `text` split on the commas outside quotes, brackets, and braces.
fn split_items(text: &str) -> Vec<&str> {
    let mut items = Vec::new();
    let mut start = 0;
    let mut depth = 0_usize;
    let mut quote = None;
    for (at, c) in text.char_indices() {
        match (quote, c) {
            (Some(open), _) if c == open => quote = None,
            (None, '"' | '\'') => quote = Some(c),
            (None, '[' | '{') => depth = depth.saturating_add(1),
            (None, ']' | '}') => depth = depth.saturating_sub(1),
            (None, ',') if depth == 0 => {
                items.push(text.get(start..at).unwrap_or_default());
                start = at.saturating_add(1);
            }
            _ => {}
        }
    }
    items.push(text.get(start..).unwrap_or_default());
    items
}

/// A scalar item without its quotes.
fn unquote(item: &str) -> String {
    quoted(item).unwrap_or_else(|| item.to_owned())
}

/// The plain value without a trailing ` # comment`.
fn plain(inline: &str) -> &str {
    inline
        .find(" #")
        .and_then(|at| inline.get(..at))
        .unwrap_or(inline)
        .trim_end()
}

fn plain_mistake(value: &str) -> Option<Mistake> {
    let colon = value.contains(": ") || value.ends_with(':');
    if value.starts_with(['`', '@', '*', '!', '%']) {
        Some(Mistake::Reserved {
            repaired: value.contains(':'),
        })
    } else {
        colon.then_some(Mistake::Colon)
    }
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{Frontmatter, Mistake, Value, read};

    fn fields(text: &str) -> Frontmatter {
        let found = read(text);
        assert!(matches!(found, Frontmatter::Fields(_)), "{found:?}");
        found
    }

    #[test]
    fn missing_and_unclosed_blocks() {
        assert_eq!(read("# Title\n---\nname: x\n---\n"), Frontmatter::Missing);
        assert_eq!(read(""), Frontmatter::Missing);
        assert_eq!(read("---\nname: x\n"), Frontmatter::Unclosed);
        assert_eq!(read("---\n---\n"), Frontmatter::Fields(Vec::new()));
        assert_eq!(read("---\r\nname: x\r\n---\r\n").text("name"), Some("x"));
    }

    #[test]
    fn plain_quoted_and_block_values() {
        let found = fields(
            "---\nname: deploy # the id\ndescription: \"Ship it: \\\"now\\\"\"\n\
             single: 'it''s'\nfolded: >-\n  one\n  two\nliteral: |\n  a\n  b\n\
             wrapped: first\n  second\nempty:\n---\nbody\n",
        );
        assert_eq!(found.text("name"), Some("deploy"));
        assert_eq!(found.text("description"), Some("Ship it: \"now\""));
        assert_eq!(found.text("single"), Some("it's"));
        assert_eq!(found.text("folded"), Some("one two"));
        assert_eq!(found.text("literal"), Some("a\nb"));
        assert_eq!(found.text("wrapped"), Some("first second"));
        assert_eq!(found.field("empty").unwrap().value, Value::Empty);
        assert_eq!(found.text("empty"), None);
        assert_eq!(found.field("description").unwrap().line, 3);
        assert_eq!(found.text("absent"), None);
    }

    #[test]
    fn lists_and_maps_are_collections() {
        let found =
            fields("---\ntags: [a, b]\nmeta: {k: v}\nlist:\n- a\n- b\nmap:\n  key: value\n---\n");
        for key in ["tags", "meta", "list", "map"] {
            assert!(found.field(key).unwrap().value.is_collection(), "{key}");
            assert_eq!(found.text(key), None);
        }
        let list = Value::List(vec!["a".to_owned(), "b".to_owned()]);
        assert_eq!(found.field("tags").unwrap().value, list);
        assert_eq!(found.field("list").unwrap().value, list);
        assert_eq!(found.field("map").unwrap().value, Value::Collection);
        assert!(!Value::Empty.is_collection());
    }

    #[test]
    fn items_read_lists_and_comma_separated_strings() {
        let found = fields(
            "---\nblock:\n  - \"src/**/*.ts\"\n  - 'lib/*.rs'\nflow: [\"a/**\", b/*.md, ]\n\
             csv: src/a.ts, , lib/b.ts\nempty:\nmap:\n  k: v\nnone: []\n---\n",
        );
        let items = |key| found.items(key);
        assert_eq!(items("block").unwrap(), ["src/**/*.ts", "lib/*.rs"]);
        assert_eq!(items("flow").unwrap(), ["a/**", "b/*.md"]);
        assert_eq!(items("csv").unwrap(), ["src/a.ts", "lib/b.ts"]);
        assert_eq!(items("empty"), None);
        assert_eq!(items("map"), None);
        assert_eq!(items("none"), None);
        assert_eq!(items("absent"), None);
        let braces = fields(
            "---\nflow: [\"src/**/*.{ts,tsx}\", 'a,b.md']\ncsv: src/**/*.{ts,tsx}, lib/*.rs\n---\n",
        );
        assert_eq!(
            braces.items("flow").unwrap(),
            ["src/**/*.{ts,tsx}", "a,b.md"]
        );
        assert_eq!(
            braces.items("csv").unwrap(),
            ["src/**/*.{ts,tsx}", "lib/*.rs"]
        );
    }

    #[test]
    fn yaml_mistakes_in_plain_values() {
        let found = fields(
            "---\ndescription: Use when: deploying\nname: x:\nwhen: [Beta] fast\n\
             a: `code` here\nb: @handle: x\nurl: https://example.com\nnote: x # a: b\n---\n",
        );
        let mistake = |key| found.field(key).unwrap().mistake;
        assert_eq!(mistake("description"), Some(Mistake::Colon));
        assert_eq!(mistake("name"), Some(Mistake::Colon));
        assert_eq!(mistake("when"), Some(Mistake::TaggedText));
        assert_eq!(found.text("when"), Some("[Beta] fast"));
        assert_eq!(mistake("a"), Some(Mistake::Reserved { repaired: false }));
        assert_eq!(mistake("b"), Some(Mistake::Reserved { repaired: true }));
        assert_eq!(mistake("url"), None);
        assert_eq!(mistake("note"), None);
        assert!(Mistake::Colon.repaired());
        assert!(!Mistake::Reserved { repaired: false }.repaired());
        assert!(Mistake::TaggedText.reason().contains("[...]"));
        assert_eq!(found.first_mistake().unwrap().key, "description");
        assert_eq!(fields("---\nname: x\n---\n").first_mistake(), None);
        assert_eq!(Frontmatter::Unclosed.first_mistake(), None);
    }

    #[test]
    fn mistakes_on_a_continuation_line_and_other_indicators() {
        let found = fields(
            "---\ndescription: Deploy the app.\n  Use when: asked to ship\n\
             alias: *Important* deploy skill\ntag: !note text\ndirective: %x\n\
             fine: Deploy.\n  Use when asked # to: ship\nnull: # nothing\n---\n",
        );
        let mistake = |key| found.field(key).unwrap().mistake;
        assert_eq!(mistake("description"), Some(Mistake::Colon));
        assert_eq!(
            found.text("description"),
            Some("Deploy the app. Use when: asked to ship")
        );
        for key in ["alias", "tag", "directive"] {
            assert_eq!(
                mistake(key),
                Some(Mistake::Reserved { repaired: false }),
                "{key}"
            );
        }
        assert_eq!(mistake("fine"), None);
        assert_eq!(found.text("fine"), Some("Deploy. Use when asked"));
        assert_eq!(found.field("null").unwrap().value, Value::Empty);
    }

    #[test]
    fn quoted_values_end_at_their_closing_quote_and_may_span_lines() {
        let found = fields(
            "---\na: 'Deploy' # it's fine\nb: \"x \\\"y\\\" z\" # \"c\"\n\
             c: \"Long text\n  # kept\n  that ends here.\"\nd: 'it''s'\n---\n",
        );
        assert_eq!(found.text("a"), Some("Deploy"));
        assert_eq!(found.text("b"), Some("x \"y\" z"));
        assert_eq!(found.text("c"), Some("Long text # kept that ends here."));
        assert_eq!(found.text("d"), Some("it's"));
    }

    #[test]
    fn block_scalars_keep_blank_and_hash_lines() {
        let found = fields(
            "---\nliteral: |\n  one\n\n  # two\n    three\n# a comment\n\
             folded: >\n  a\n  b\n\n  c\n---\n",
        );
        assert_eq!(found.text("literal"), Some("one\n\n# two\n  three"));
        assert_eq!(found.text("folded"), Some("a b\nc"));
    }

    #[test]
    fn booleans_read_like_both_agents() {
        let found = fields("---\na: true\nb: Yes\nc: on\nd: 1\ne: false\nf: [true]\n---\n");
        assert!(["a", "b", "c", "d"].iter().all(|key| found.is_true(key)));
        assert!(!found.is_true("e"));
        assert!(!found.is_true("f"));
        assert!(!found.is_true("absent"));
        assert!(!Frontmatter::Missing.is_true("a"));
    }

    #[test]
    fn lines_that_are_not_keys_continue_the_previous_value() {
        let found = fields("---\n# comment\nstray line\nhttp://x: y\nname: x\n  # note\n---\n");
        assert_eq!(found.text("name"), Some("x"));
        assert_eq!(found.field("http"), None);
    }
}
