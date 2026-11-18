//! Probes `SK06`–`SK12`: each skill's frontmatter, size, and links. Pure functions of a
//! [`Snapshot`].

use std::path::{Path, PathBuf};

use vitals_utils::frontmatter::{self, Field, Frontmatter, Value};
use vitals_utils::markdown;
use vitals_utils::{Finding, TextSize, Verdict, or_pass};

use crate::probes::{DESCRIPTION, LINE_LIMIT, no_skill};
use crate::snapshot::{Link, Skill, Snapshot};

/// A skill with its frontmatter read.
struct Judged<'a> {
    skill: &'a Skill,
    front: Frontmatter,
    path: PathBuf,
}

impl Judged<'_> {
    const fn has_fields(&self) -> bool {
        matches!(self.front, Frontmatter::Fields(_))
    }

    fn finding(
        &self,
        probe: &'static str,
        verdict: Verdict,
        message: impl Into<String>,
    ) -> Finding {
        Finding::new(probe, verdict, &self.path, message)
    }
}

/// Which skills a probe judges.
#[derive(Clone, Copy)]
enum Judges {
    All,
    /// `SK07`–`SK10` read fields: a skill without a frontmatter block is `SK06`'s finding.
    WithFields,
}

type Check = fn(&Judged<'_>) -> Option<Finding>;

/// `SK06`–`SK11`: at most one finding per skill.
const ONE_PER_SKILL: [(&str, Judges, Check, &str); 6] = [
    (
        "SK06",
        Judges::All,
        parses,
        "every SKILL.md opens with frontmatter that YAML accepts",
    ),
    (
        "SK07",
        Judges::WithFields,
        described,
        "every skill has a description to match",
    ),
    (
        "SK08",
        Judges::WithFields,
        sized,
        "every description is within budget",
    ),
    (
        "SK09",
        Judges::WithFields,
        portable,
        "no skill keeps trigger text in `when_to_use`",
    ),
    (
        "SK10",
        Judges::WithFields,
        named,
        "every skill name follows the Agent Skills rule",
    ),
    (
        "SK11",
        Judges::All,
        short,
        "every SKILL.md is within the line budget",
    ),
];

pub(crate) fn findings(snapshot: &Snapshot) -> Vec<Finding> {
    let judged: Vec<Judged<'_>> = snapshot
        .skills
        .iter()
        .map(|skill| Judged {
            skill,
            front: frontmatter::read(&skill.text),
            path: skill.place.skill_md(),
        })
        .collect();
    let all: Vec<&Judged<'_>> = judged.iter().collect();
    let fielded: Vec<&Judged<'_>> = judged.iter().filter(|one| one.has_fields()).collect();
    let pick = |judges| match judges {
        Judges::All => all.as_slice(),
        Judges::WithFields => fielded.as_slice(),
    };
    let singles = ONE_PER_SKILL
        .iter()
        .flat_map(|&(probe, judges, check, pass)| each(probe, pick(judges), check, pass));
    let links = each(
        "SK12",
        &all,
        |one: &Judged<'_>| references(one, &snapshot.files),
        "every relative link resolves",
    );
    singles.chain(links).collect()
}

/// Runs a per-skill probe: its findings, a pass when there are none, or `n/a` when there is
/// no skill to judge.
fn each<I>(
    probe: &'static str,
    skills: &[&Judged<'_>],
    check: impl Fn(&Judged<'_>) -> I,
    pass: &str,
) -> Vec<Finding>
where
    I: IntoIterator<Item = Finding>,
{
    if skills.is_empty() {
        return vec![no_skill(probe)];
    }
    let found = skills.iter().flat_map(|judged| check(judged)).collect();
    or_pass(found, Finding::new(probe, Verdict::Pass, ".", pass))
}

/// `SK06`: the frontmatter opens on line 1, closes, and holds no plain value YAML rejects.
fn parses(judged: &Judged<'_>) -> Option<Finding> {
    let (message, fix) = match &judged.front {
        Frontmatter::Missing => (
            "no frontmatter: `---` is not the first line, so OpenCode lists no description and \
             never loads the skill on its own, and Claude Code reads the whole file as \
             instructions"
                .to_owned(),
            format!(
                "open SKILL.md with `---`, `name: {}`, `description: <what it does and when to \
                 use it>`, `---`",
                judged.skill.place.name
            ),
        ),
        Frontmatter::Unclosed => (
            "the frontmatter opens on line 1 and no `---` line closes it".to_owned(),
            "close the block with a `---` line before the body".to_owned(),
        ),
        Frontmatter::Fields(_) => yaml_problem(judged.front.first_mistake()?)?,
    };
    Some(judged.finding("SK06", Verdict::Fail, message).with_fix(fix))
}

/// The message and fix for a plain value that YAML rejects.
fn yaml_problem(field: &Field) -> Option<(String, String)> {
    let mistake = field.mistake?;
    let opencode = if mistake.repaired() {
        "OpenCode repairs the value"
    } else {
        "OpenCode skips the skill"
    };
    let key = &field.key;
    Some((
        format!(
            "line {}: the `{key}` value {}: YAML rejects it, so Claude Code loads the skill with \
             no frontmatter fields, and {opencode}",
            field.line,
            mistake.reason()
        ),
        format!(
            "quote the value (`{key}: \"...\"`) or write it as a block scalar (`{key}: >-`, then \
             the text indented below)"
        ),
    ))
}

/// `SK07`: a description both agents can match, unless only the user invokes the skill.
fn described(judged: &Judged<'_>) -> Option<Finding> {
    let front = &judged.front;
    if front.text("description").is_some() || front.is_true("disable-model-invocation") {
        return None;
    }
    let message = match front.field("description").map(|field| &field.value) {
        Some(Value::List(_) | Value::Collection) => {
            "`description` is not a string: OpenCode skips the skill"
        }
        Some(Value::Text(_) | Value::Empty) | None => {
            "no description: OpenCode never lists the skill to the model, and Claude Code \
             matches on the first line of the body"
        }
    };
    Some(judged.finding("SK07", Verdict::Fail, message).with_fix(
        "add `description:` with what the skill does, then when to use it, in words a user \
         would type; or set `disable-model-invocation: true` for a skill only the user invokes",
    ))
}

/// `SK08`: `description` and `when_to_use` fit the [`DESCRIPTION`] budget.
fn sized(judged: &Judged<'_>) -> Option<Finding> {
    let chars: usize = ["description", "when_to_use"]
        .iter()
        .filter_map(|key| judged.front.text(key))
        .map(|text| text.chars().count())
        .sum();
    let verdict = DESCRIPTION.verdict(chars);
    (verdict > Verdict::Pass).then(|| {
        judged
            .finding(
                "SK08",
                verdict,
                DESCRIPTION.describe(chars, "chars of description and when_to_use"),
            )
            .with_fix(
                "put the key use case first and cut the text to 1,024 chars: Claude Code \
                 truncates the listing at 1,536, and claude.ai uploads reject more than 1,024",
            )
    })
}

/// `SK09`: no trigger text in `when_to_use`, which `OpenCode` does not read.
fn portable(judged: &Judged<'_>) -> Option<Finding> {
    judged.front.field("when_to_use").map(|_| {
        judged
            .finding(
                "SK09",
                Verdict::Warn,
                "OpenCode does not read `when_to_use`: its trigger phrases reach Claude Code only",
            )
            .with_fix("fold it into `description` and delete the field")
    })
}

/// A name problem: verdict, message, fix.
type Problem = (Verdict, String, String);

/// `SK10`: the name loads in Claude Code, is a string to `OpenCode`, follows the spec, and
/// matches its folder.
fn named(judged: &Judged<'_>) -> Option<Finding> {
    let checks: [fn(&Judged<'_>) -> Option<Problem>; 4] =
        [reserved, not_a_string, mismatched, off_spec];
    let (verdict, message, fix) = checks.iter().find_map(|check| check(judged))?;
    Some(judged.finding("SK10", verdict, message).with_fix(fix))
}

fn effective_name<'a>(judged: &'a Judged<'_>) -> &'a str {
    judged
        .front
        .text("name")
        .unwrap_or(&judged.skill.place.name)
}

fn reserved(judged: &Judged<'_>) -> Option<Problem> {
    let is_reserved = |name: &str| {
        name.eq_ignore_ascii_case("synced")
            || name == "anthropic-skills"
            || name.starts_with("anthropic-skills:")
    };
    let folder = judged.skill.place.name.as_str();
    let name = [Some(folder), judged.front.text("name")]
        .into_iter()
        .flatten()
        .find(|name| is_reserved(name))?;
    Some((
        Verdict::Fail,
        format!("`{name}` is a name Claude Code reserves, so it does not load the skill"),
        "rename the folder (and `name`)".to_owned(),
    ))
}

fn not_a_string(judged: &Judged<'_>) -> Option<Problem> {
    let field = judged.front.field("name")?;
    field.value.is_collection().then(|| {
        (
            Verdict::Fail,
            "`name` is not a string: OpenCode skips the skill".to_owned(),
            format!("write `name: {}`", judged.skill.place.name),
        )
    })
}

fn mismatched(judged: &Judged<'_>) -> Option<Problem> {
    let folder = &judged.skill.place.name;
    let name = judged.front.text("name").filter(|name| name != folder)?;
    Some((
        Verdict::Warn,
        format!(
            "`name: {name}` differs from the folder `{folder}`: Claude Code invokes /{name}, \
             OpenCode the id `{folder}`"
        ),
        format!("rename the folder to `{name}`, or set `name: {folder}`"),
    ))
}

fn off_spec(judged: &Judged<'_>) -> Option<Problem> {
    let name = effective_name(judged);
    (!spec_name(name)).then(|| {
        (
            Verdict::Warn,
            format!(
                "`{name}` breaks the Agent Skills name rule: 1-64 chars of a-z, 0-9, and single \
                 hyphens, no hyphen at either end"
            ),
            "rename the folder (and `name`) to lowercase words joined by single hyphens".to_owned(),
        )
    })
}

/// The Agent Skills spec's `name` rule.
fn spec_name(name: &str) -> bool {
    let length = name.chars().count();
    (1..=64).contains(&length)
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && !name.starts_with('-')
        && !name.ends_with('-')
        && !name.contains("--")
}

/// `SK11`: `SKILL.md` stays under [`LINE_LIMIT`] lines.
fn short(judged: &Judged<'_>) -> Option<Finding> {
    let lines = TextSize::of(&judged.skill.text).lines();
    (lines > LINE_LIMIT).then(|| {
        judged
            .finding(
                "SK11",
                Verdict::Warn,
                format!("{lines} lines (warn above {LINE_LIMIT})"),
            )
            .with_fix(
                "keep the steps in SKILL.md and move reference detail into files next to it, \
                 linked with what each holds",
            )
    })
}

/// `SK12`: every relative link in `SKILL.md` points to a file or directory that exists.
fn references(judged: &Judged<'_>, repository: &[PathBuf]) -> Vec<Finding> {
    markdown::link_targets(&judged.skill.text)
        .into_iter()
        .filter(|target| broken(judged.skill, target, repository))
        .map(|target| {
            judged
                .finding(
                    "SK12",
                    Verdict::Fail,
                    format!("links to `{target}`, which does not exist"),
                )
                .with_fix("fix the path, relative to the skill folder, or remove the link")
        })
        .collect()
}

/// Whether `target` resolves to nothing. Inside the skill folder it is looked up in the
/// skill's own files, else in the repository. A link that leaves a symbolic-link folder
/// resolves from where the folder is linked (a path read as written) or from where it
/// really is (the disk): either passes. Behind a folder outside the repository, or when it
/// climbs out of the repository, it is not judged.
fn broken(skill: &Skill, target: &str, repository: &[PathBuf]) -> bool {
    let dir = skill.place.dir();
    let Some(path) = markdown::resolve(&dir, target) else {
        return false;
    };
    if let Ok(inside) = path.strip_prefix(&dir) {
        return !listed(&skill.files, inside);
    }
    let missing = !listed(repository, &path);
    match &skill.link {
        None => missing,
        Some(Link::Outside) => false,
        Some(Link::Inside(real)) => {
            missing
                && markdown::resolve(real, target)
                    .is_some_and(|physical| !listed(repository, &physical))
        }
    }
}

/// Whether `target` is a file of `files`, or a directory holding one.
fn listed(files: &[PathBuf], target: &Path) -> bool {
    target.as_os_str().is_empty() || files.iter().any(|file| file.starts_with(target))
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{findings, spec_name};
    use crate::layout::{Place, Root};
    use crate::probes::DESCRIPTION;
    use crate::snapshot::{Link, Skill, Snapshot};
    use std::path::PathBuf;
    use vitals_utils::{Finding, Verdict};

    fn skill(name: &str, text: &str, files: &[&str]) -> Skill {
        Skill {
            place: Place {
                scope: PathBuf::new(),
                root: Root::Claude,
                name: name.to_owned(),
            },
            text: text.to_owned(),
            files: files.iter().map(PathBuf::from).collect(),
            link: None,
        }
    }

    fn front(name: &str, extra: &str) -> String {
        format!(
            "---\nname: {name}\ndescription: Does {name}. Use when asked to.\n{extra}---\n# {name}\n"
        )
    }

    fn run(skills: Vec<Skill>, repository: &[&str]) -> Vec<Finding> {
        findings(&Snapshot {
            skills,
            files: repository.iter().map(PathBuf::from).collect(),
            user: None,
        })
    }

    fn verdicts(found: &[Finding], probe: &str) -> Vec<Verdict> {
        found
            .iter()
            .filter(|finding| finding.probe() == probe)
            .map(Finding::verdict)
            .collect()
    }

    fn message<'a>(found: &'a [Finding], probe: &str) -> &'a str {
        found
            .iter()
            .find(|finding| finding.probe() == probe)
            .unwrap()
            .message()
    }

    #[test]
    fn no_skill_means_every_probe_is_not_applicable() {
        let found = run(Vec::new(), &[]);
        assert_eq!(found.len(), 7);
        assert!(found.iter().all(|f| f.verdict() == Verdict::NotApplicable));
    }

    #[test]
    fn a_healthy_skill_passes() {
        let found = run(
            vec![skill("deploy", &front("deploy", ""), &["SKILL.md"])],
            &[],
        );
        assert!(
            found.iter().all(|f| f.verdict() == Verdict::Pass),
            "{found:?}"
        );
    }

    #[test]
    fn missing_and_unclosed_frontmatter_fail_and_skip_the_field_probes() {
        let found = run(
            vec![
                skill("bare", "# Bare\nSteps.\n", &[]),
                skill("open", "---\nname: open\n# never closed\n", &[]),
            ],
            &[],
        );
        assert_eq!(verdicts(&found, "SK06"), [Verdict::Fail, Verdict::Fail]);
        assert!(message(&found, "SK06").starts_with("no frontmatter"));
        for probe in ["SK07", "SK08", "SK09", "SK10"] {
            assert_eq!(verdicts(&found, probe), [Verdict::NotApplicable], "{probe}");
        }
        assert_eq!(verdicts(&found, "SK11"), [Verdict::Pass]);
    }

    #[test]
    fn yaml_mistakes_fail_with_what_each_agent_does() {
        let colon = skill(
            "a",
            "---\nname: a\ndescription: Use when: deploying\n---\n",
            &[],
        );
        let backtick = skill(
            "b",
            "---\nname: b\ndescription: `b` runs things\n---\n",
            &[],
        );
        let found = run(vec![colon, backtick], &[]);
        let messages: Vec<&str> = found
            .iter()
            .filter(|f| f.probe() == "SK06")
            .map(Finding::message)
            .collect();
        assert_eq!(messages.len(), 2);
        assert!(messages[0].starts_with("line 3: the `description` value holds an unquoted `: `"));
        assert!(messages[0].ends_with("OpenCode repairs the value"));
        assert!(messages[1].ends_with("OpenCode skips the skill"));
    }

    #[test]
    fn descriptions_must_exist_unless_the_skill_is_manual_only() {
        let found = run(
            vec![
                skill("none", "---\nname: none\n---\n", &[]),
                skill("list", "---\nname: list\ndescription:\n  - a\n---\n", &[]),
                skill(
                    "manual",
                    "---\nname: manual\ndisable-model-invocation: yes\n---\n",
                    &[],
                ),
            ],
            &[],
        );
        assert_eq!(verdicts(&found, "SK07"), [Verdict::Fail, Verdict::Fail]);
        let messages: Vec<&str> = found
            .iter()
            .filter(|f| f.probe() == "SK07")
            .map(Finding::message)
            .collect();
        assert!(messages[0].starts_with("no description"));
        assert!(messages[1].contains("not a string"));
    }

    #[test]
    fn description_budget_edges() {
        let sized = |chars: usize, extra: &str| {
            let text = format!(
                "---\nname: x\ndescription: {}\n{extra}---\n",
                "d".repeat(chars)
            );
            verdicts(&run(vec![skill("x", &text, &[])], &[]), "SK08")[0]
        };
        assert_eq!(sized(DESCRIPTION.warn(), ""), Verdict::Pass);
        assert_eq!(sized(DESCRIPTION.warn() + 1, ""), Verdict::Warn);
        assert_eq!(sized(DESCRIPTION.fail(), ""), Verdict::Warn);
        assert_eq!(sized(DESCRIPTION.fail() + 1, ""), Verdict::Fail);
        // `when_to_use` counts toward the cap Claude Code applies.
        assert_eq!(
            sized(DESCRIPTION.fail() - 4, "when_to_use: abcde\n"),
            Verdict::Fail
        );
    }

    #[test]
    fn when_to_use_warns() {
        let found = run(
            vec![skill("x", &front("x", "when_to_use: on deploy\n"), &[])],
            &[],
        );
        assert_eq!(verdicts(&found, "SK09"), [Verdict::Warn]);
        assert!(message(&found, "SK09").starts_with("OpenCode does not read"));
    }

    #[test]
    fn names_reserved_non_string_mismatched_and_off_spec() {
        let found = run(
            vec![
                skill("synced", &front("synced", ""), &[]),
                skill(
                    "tool",
                    "---\nname: anthropic-skills:tool\ndescription: d\n---\n",
                    &[],
                ),
                skill("listed", "---\nname: [a]\ndescription: d\n---\n", &[]),
                skill("deploy", &front("ship", ""), &[]),
                skill("Deploy_App", "---\ndescription: d\n---\n", &[]),
                skill("ok-name", "---\ndescription: d\n---\n", &[]),
            ],
            &[],
        );
        assert_eq!(
            verdicts(&found, "SK10"),
            [
                Verdict::Fail,
                Verdict::Fail,
                Verdict::Fail,
                Verdict::Warn,
                Verdict::Warn
            ]
        );
        let messages: Vec<&str> = found
            .iter()
            .filter(|f| f.probe() == "SK10")
            .map(Finding::message)
            .collect();
        assert!(messages[1].starts_with("`anthropic-skills:tool` is a name Claude Code reserves"));
        assert!(messages[3].contains("Claude Code invokes /ship, OpenCode the id `deploy`"));
        assert!(messages[4].starts_with("`Deploy_App` breaks the Agent Skills name rule"));
    }

    #[test]
    fn spec_name_rule() {
        assert!(spec_name("pdf-processing"));
        assert!(spec_name(&"a".repeat(64)));
        assert!(!spec_name(&"a".repeat(65)));
        assert!(!spec_name(""));
        assert!(!spec_name("-pdf"));
        assert!(!spec_name("pdf-"));
        assert!(!spec_name("pdf--x"));
        assert!(!spec_name("PDF"));
    }

    #[test]
    fn line_budget_edges() {
        let lines = |count: usize| {
            let head = front("x", "");
            let body = "x\n".repeat(count - head.lines().count());
            verdicts(
                &run(vec![skill("x", &format!("{head}{body}"), &[])], &[]),
                "SK11",
            )[0]
        };
        assert_eq!(lines(500), Verdict::Pass);
        assert_eq!(lines(501), Verdict::Warn);
    }

    #[test]
    fn broken_relative_links_fail_and_the_rest_resolve() {
        let text = format!(
            "{}See [guide](references/guide.md), [scripts](scripts), [docs](../../../docs/a.md),\n\
             [gone](references/missing.md), [old](../../../docs/old.md), [out](../../../../x.md),\n\
             [self](.), [web](https://example.com).\n",
            front("x", "")
        );
        let found = run(
            vec![skill(
                "x",
                &text,
                &["SKILL.md", "references/guide.md", "scripts/run.sh"],
            )],
            &["docs/a.md"],
        );
        let broken: Vec<&str> = found
            .iter()
            .filter(|f| f.probe() == "SK12")
            .map(Finding::message)
            .collect();
        assert_eq!(
            broken,
            [
                "links to `references/missing.md`, which does not exist",
                "links to `../../../docs/old.md`, which does not exist",
            ]
        );
    }

    #[test]
    fn links_out_of_a_linked_folder_resolve_from_either_side() {
        let text = format!(
            "{}[real](../common.md) [linked](../deploy/SKILL.md) [gone](../gone.md)\n",
            front("review", "")
        );
        let linked = |link| Skill {
            link: Some(link),
            ..skill("review", &text, &["SKILL.md"])
        };
        let repository = &["shared/common.md", ".claude/skills/deploy/SKILL.md"];
        let broken = |skill| -> Vec<String> {
            run(vec![skill], repository)
                .iter()
                .filter(|f| f.probe() == "SK12" && f.verdict() == Verdict::Fail)
                .map(|f| f.message().to_owned())
                .collect()
        };
        assert_eq!(
            broken(linked(Link::Inside(PathBuf::from("shared/review")))),
            ["links to `../gone.md`, which does not exist"]
        );
        assert_eq!(broken(linked(Link::Outside)), Vec::<String>::new());
        assert_eq!(
            broken(skill("review", &text, &["SKILL.md"])).len(),
            2,
            "a plain folder resolves from where it is"
        );
    }
}
