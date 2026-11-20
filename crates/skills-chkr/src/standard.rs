//! Probes `SK16`–`SK20`: each skill against the frontmatter reference, the Agent Skills
//! spec, and its guidance on scripts. Pure functions of a [`Snapshot`].

use std::path::{Component, Path};

use vitals_utils::frontmatter::{Frontmatter, Value};
use vitals_utils::markdown::{self, Region};
use vitals_utils::{Finding, Verdict};

use crate::content::{Judged, each, judge};
use crate::probes::COMPATIBILITY;
use crate::snapshot::Snapshot;

/// Every field of the Claude Code frontmatter reference, which holds the six of the Agent
/// Skills spec and the four `OpenCode` reads. Claude Code ignores any other key without an
/// error (skills docs, "Frontmatter reference").
const FIELDS: [&str; 20] = [
    "name",
    "description",
    "when_to_use",
    "argument-hint",
    "arguments",
    "disable-model-invocation",
    "user-invocable",
    "allowed-tools",
    "disallowed-tools",
    "model",
    "effort",
    "context",
    "agent",
    "background",
    "hooks",
    "paths",
    "shell",
    "metadata",
    "license",
    "compatibility",
];

/// Where a skill keeps the scripts it runs (Agent Skills spec, "scripts/").
const SCRIPTS: &str = "scripts";

/// How many items a message names before it counts the rest.
const NAMED: usize = 3;

type Check = fn(&Judged<'_>) -> Option<Finding>;

const PROBES: [(&str, Check, &str); 5] = [
    (
        "SK16",
        unknown_fields,
        "every frontmatter field is one an agent reads",
    ),
    (
        "SK17",
        compatible,
        "every `compatibility` is a string within budget",
    ),
    (
        "SK18",
        scripts_named,
        "every file in scripts/ is named in its SKILL.md",
    ),
    ("SK19", pinned, "every package command names a version"),
    (
        "SK20",
        injections_allowed,
        "no command-injection line without `allowed-tools`",
    ),
];

pub(crate) fn findings(snapshot: &Snapshot) -> Vec<Finding> {
    let judged = judge(snapshot);
    let all: Vec<&Judged<'_>> = judged.iter().collect();
    PROBES
        .iter()
        .flat_map(|&(probe, check, pass)| each(probe, &all, check, pass))
        .collect()
}

/// `first, second, third and N more`.
fn named(items: &[String]) -> String {
    let shown = items.iter().take(NAMED).cloned().collect::<Vec<_>>();
    let more = items.len().saturating_sub(NAMED);
    if more == 0 {
        shown.join(", ")
    } else {
        format!("{} and {more} more", shown.join(", "))
    }
}

/// `SK16`: no top-level key outside [`FIELDS`].
fn unknown_fields(judged: &Judged<'_>) -> Option<Finding> {
    let Frontmatter::Fields(fields) = &judged.front else {
        return None;
    };
    let unknown: Vec<String> = fields
        .iter()
        .filter(|field| !FIELDS.contains(&field.key.as_str()))
        .map(|field| format!("`{}` (line {})", field.key, field.line))
        .collect();
    (!unknown.is_empty()).then(|| {
        judged
            .finding(
                "SK16",
                Verdict::Warn,
                format!(
                    "{}: not a frontmatter field; Claude Code and OpenCode ignore it without \
                     an error",
                    named(&unknown)
                ),
            )
            .with_fix(
                "spell it as the frontmatter reference does (hyphens, except `when_to_use`), \
                 or keep your own data under `metadata`",
            )
    })
}

/// `SK17`: `compatibility` is a string within [`COMPATIBILITY`].
fn compatible(judged: &Judged<'_>) -> Option<Finding> {
    let field = judged.front.field("compatibility")?;
    let problem = match &field.value {
        Value::Text(text) => {
            let chars = text.trim().chars().count();
            (COMPATIBILITY.verdict(chars) > Verdict::Pass)
                .then(|| COMPATIBILITY.describe(chars, "chars of compatibility"))
        }
        Value::Empty => None,
        Value::List(_) | Value::Collection => {
            Some("`compatibility` is a list or a map, not a string".to_owned())
        }
    };
    problem.map(|message| {
        judged.finding("SK17", Verdict::Warn, message).with_fix(
            "write it as one string of at most 500 chars: the Agent Skills spec accepts no \
             other form",
        )
    })
}

/// `SK18`: `SKILL.md` names every file of `scripts/`, by its path or its file name.
fn scripts_named(judged: &Judged<'_>) -> Option<Finding> {
    let text = &judged.skill.text;
    let unnamed: Vec<String> = judged
        .skill
        .files
        .iter()
        .filter(|file| is_script(file))
        .filter(|file| {
            let name = file.file_name().map(|name| name.to_string_lossy());
            !name.is_some_and(|name| text.contains(name.as_ref()))
        })
        .map(|file| format!("`{}`", slashed(file)))
        .collect();
    (!unnamed.is_empty()).then(|| {
        judged
            .finding(
                "SK18",
                Verdict::Warn,
                format!(
                    "{}: in scripts/ and never named in SKILL.md, so an agent does not know it \
                     exists",
                    named(&unnamed)
                ),
            )
            .with_fix(
                "name each script in SKILL.md with the command that runs it, or move a file \
                 that only other scripts load out of scripts/",
            )
    })
}

/// Whether `file`, relative to the skill folder, is a visible file under `scripts/`.
fn is_script(file: &Path) -> bool {
    let mut parts = file.components();
    let in_scripts = parts.next() == Some(Component::Normal(SCRIPTS.as_ref()));
    let hidden = parts.any(|part| {
        let name = part.as_os_str().to_string_lossy();
        name.starts_with('.') || name.starts_with("__")
    });
    in_scripts && !hidden && file.components().count() > 1
}

/// `file` with forward slashes, whatever the platform.
fn slashed(file: &Path) -> String {
    file.components()
        .map(|part| part.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

/// `SK19`: every one-off package command in code names a version.
fn pinned(judged: &Judged<'_>) -> Option<Finding> {
    let unpinned: Vec<String> = markdown::lines(&judged.skill.text)
        .flat_map(|line| {
            let code: Vec<&str> = match line.region {
                Region::Code => vec![line.text],
                Region::Prose => markdown::code_spans(line.text).collect(),
                Region::Comment => Vec::new(),
            };
            code.into_iter()
                .flat_map(unpinned_in)
                .map(move |package| format!("`{package}` (line {})", line.number))
        })
        .collect();
    (!unpinned.is_empty()).then(|| {
        judged
            .finding(
                "SK19",
                Verdict::Warn,
                format!(
                    "{}: a package command without a version runs whatever is latest that day",
                    named(&unpinned)
                ),
            )
            .with_fix("pin each one, as in `npx eslint@9.0.0` or `uvx ruff@0.8.0`")
    })
}

/// The runners that fetch and run a package, as the words that open the command.
const RUNNERS: [&[&str]; 6] = [
    &["npx"],
    &["bunx"],
    &["uvx"],
    &["pnpm", "dlx"],
    &["yarn", "dlx"],
    &["pipx", "run"],
];

/// The options whose value is the package to run.
const PACKAGE_OPTIONS: [&str; 3] = ["--package", "-p", "--from"];

/// The packages that the commands of `code` run without a version, each as
/// `<runner> <package>`.
fn unpinned_in(code: &str) -> Vec<String> {
    let words: Vec<&str> = code.split_whitespace().collect();
    (0..words.len())
        .filter_map(|at| {
            let rest = words.get(at..)?;
            let runner = RUNNERS.iter().find(|runner| rest.starts_with(runner))?;
            let package = package_of(rest.get(runner.len()..)?)?;
            (!has_version(package)).then(|| format!("{} {package}", runner.join(" ")))
        })
        .collect()
}

/// The package a runner's arguments name: the value of a package option, else the first
/// word that is not an option. A path, a variable, or a placeholder is not a package.
fn package_of<'a>(args: &[&'a str]) -> Option<&'a str> {
    let by_option = args
        .iter()
        .skip_while(|word| !PACKAGE_OPTIONS.contains(word))
        .nth(1);
    let package = by_option.or_else(|| args.iter().find(|word| !word.starts_with('-')))?;
    let local = package.starts_with(['.', '/', '$', '<', '{', '~']);
    let word = package
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || "@/._-=<>~^".contains(c));
    (!local && word).then_some(*package)
}

/// Whether `package` carries a version: `name@1.2.3`, `@scope/name@1`, or `name==1.2.3`.
fn has_version(package: &str) -> bool {
    let name = package.strip_prefix('@').unwrap_or(package);
    name.contains('@') || name.contains("==")
}

/// `SK20`: a skill that injects a command pre-approves it with `allowed-tools`.
fn injections_allowed(judged: &Judged<'_>) -> Option<Finding> {
    if judged.front.field("allowed-tools").is_some() {
        return None;
    }
    let lines: Vec<String> = markdown::lines(&judged.skill.text)
        .filter(|line| injects(line.text))
        .map(|line| line.number.to_string())
        .collect();
    (!lines.is_empty()).then(|| {
        judged
            .finding(
                "SK20",
                Verdict::Warn,
                format!(
                    "command injection at line {} and no `allowed-tools`: outside auto mode \
                     Claude Code aborts the skill unless a permission rule allows the command",
                    named(&lines)
                ),
            )
            .with_fix(
                "pre-approve each injected command in `allowed-tools`; when the line only \
                 cites the syntax, name it in words",
            )
    })
}

/// Whether Claude Code runs a command from `line` when the skill loads: an exclamation
/// mark before a backtick, at the start of the line or after whitespace, or a fence that
/// opens with three backticks and an exclamation mark.
fn injects(line: &str) -> bool {
    const MARK: &str = "!`";
    let fence = line.trim_start().starts_with("```!");
    let inline = line.match_indices(MARK).any(|(at, _)| {
        line.get(..at)
            .and_then(|before| before.chars().next_back())
            .is_none_or(char::is_whitespace)
    });
    fence || inline
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{findings, has_version, injects, unpinned_in};
    use crate::layout::{Place, Root};
    use crate::probes::COMPATIBILITY;
    use crate::snapshot::{Skill, Snapshot};
    use std::path::PathBuf;
    use vitals_utils::{Finding, Verdict};

    fn found(front: &str, body: &str, files: &[&str]) -> Vec<Finding> {
        let skill = Skill {
            place: Place {
                scope: PathBuf::new(),
                root: Root::Claude,
                name: "deploy".to_owned(),
            },
            text: format!("---\nname: deploy\ndescription: Deploy.\n{front}---\n{body}"),
            files: files.iter().map(PathBuf::from).collect(),
            link: None,
        };
        findings(&Snapshot {
            skills: vec![skill],
            files: Vec::new(),
            user: None,
        })
    }

    fn one<'a>(all: &'a [Finding], probe: &str) -> &'a Finding {
        all.iter().find(|finding| finding.probe() == probe).unwrap()
    }

    fn verdict(front: &str, body: &str, files: &[&str], probe: &str) -> Verdict {
        one(&found(front, body, files), probe).verdict()
    }

    #[test]
    fn a_healthy_skill_passes_and_no_skill_is_not_applicable() {
        let all = found("", "# Deploy\n", &["SKILL.md"]);
        let probes: Vec<&str> = all.iter().map(Finding::probe).collect();
        assert_eq!(probes, ["SK16", "SK17", "SK18", "SK19", "SK20"]);
        assert!(all.iter().all(|finding| finding.verdict() == Verdict::Pass));
        let none = findings(&Snapshot::default());
        assert!(none.iter().all(|f| f.verdict() == Verdict::NotApplicable));
    }

    #[test]
    fn a_misspelled_field_warns_and_every_reference_field_passes() {
        let all = found(
            "disable_model_invocation: true\nuser-invocable: false\n",
            "",
            &[],
        );
        let unknown = one(&all, "SK16");
        assert_eq!(unknown.verdict(), Verdict::Warn);
        assert!(
            unknown
                .message()
                .starts_with("`disable_model_invocation` (line 4): not a")
        );
        let known = "when_to_use: x\nallowed-tools: Read\nmetadata:\n  a: b\nlicense: MIT\n";
        assert_eq!(verdict(known, "", &[], "SK16"), Verdict::Pass);
        let many = found("a: 1\nb: 2\nc: 3\nd: 4\n", "", &[]);
        assert!(
            one(&many, "SK16")
                .message()
                .contains("`c` (line 6) and 1 more")
        );
    }

    #[test]
    fn a_skill_without_frontmatter_has_no_field_to_judge() {
        let skill = Skill {
            place: Place {
                scope: PathBuf::new(),
                root: Root::Claude,
                name: "deploy".to_owned(),
            },
            text: "# Deploy\n".to_owned(),
            files: Vec::new(),
            link: None,
        };
        let all = findings(&Snapshot {
            skills: vec![skill],
            files: Vec::new(),
            user: None,
        });
        assert_eq!(one(&all, "SK16").verdict(), Verdict::Pass);
    }

    #[test]
    fn compatibility_budget_edges_and_shape() {
        let of = |chars: usize| format!("compatibility: {}\n", "x".repeat(chars));
        let at = COMPATIBILITY.warn();
        assert_eq!(verdict(&of(at), "", &[], "SK17"), Verdict::Pass);
        assert_eq!(verdict(&of(at + 1), "", &[], "SK17"), Verdict::Warn);
        assert_eq!(verdict("compatibility:\n", "", &[], "SK17"), Verdict::Pass);
        let list = found("compatibility: [node, git]\n", "", &[]);
        assert!(one(&list, "SK17").message().contains("not a string"));
    }

    #[test]
    fn a_script_the_skill_never_names_warns() {
        let files = [
            "SKILL.md",
            "scripts/check.sh",
            "scripts/lib/util.py",
            "scripts/.cache",
            "scripts/__pycache__/x.pyc",
            "references/scripts/notes.md",
        ];
        let all = found("", "Run `bash scripts/check.sh`.\n", &files);
        let unnamed = one(&all, "SK18");
        assert_eq!(unnamed.verdict(), Verdict::Warn);
        assert!(
            unnamed
                .message()
                .starts_with("`scripts/lib/util.py`: in scripts/")
        );
        let both = "Run `scripts/check.sh`; it loads util.py.\n";
        assert_eq!(verdict("", both, &files, "SK18"), Verdict::Pass);
        assert_eq!(verdict("", "", &["scripts"], "SK18"), Verdict::Pass);
    }

    #[test]
    fn package_commands_are_judged_in_code_only() {
        let body = "Run npx prose-pkg here.\n\n```sh\nnpx --yes eslint .\nuvx ruff@0.8.0 check\n```\n\
                    Then `pnpm dlx qol-mini vitals`.\n<!--\nnpx hidden\n-->\n";
        let all = found("", body, &[]);
        let unpinned = one(&all, "SK19");
        assert_eq!(unpinned.verdict(), Verdict::Warn);
        assert_eq!(
            unpinned.message(),
            "`npx eslint` (line 8), `pnpm dlx qol-mini` (line 11): a package command without \
             a version runs whatever is latest that day"
        );
        assert_eq!(
            verdict("", "`npx eslint@9.0.0 .`\n", &[], "SK19"),
            Verdict::Pass
        );
    }

    #[test]
    fn runners_options_and_placeholders() {
        assert_eq!(unpinned_in("npx -p typescript tsc"), ["npx typescript"]);
        assert_eq!(unpinned_in("uvx --from black==24.1 black ."), [""; 0]);
        assert_eq!(unpinned_in("pipx run cowsay hi"), ["pipx run cowsay"]);
        assert_eq!(
            unpinned_in("yarn dlx @scope/tool"),
            ["yarn dlx @scope/tool"]
        );
        assert_eq!(unpinned_in("bunx @scope/tool@2 x"), [""; 0]);
        assert_eq!(unpinned_in("npx ./local.js && npx $TOOL"), [""; 0]);
        assert_eq!(unpinned_in("npx <package> | npx"), [""; 0]);
        assert_eq!(unpinned_in("pnpm install"), [""; 0]);
        assert_eq!(unpinned_in("npx --yes"), [""; 0]);
        assert!(has_version("@scope/name@1"));
        assert!(!has_version("@scope/name"));
    }

    #[test]
    fn an_injection_without_allowed_tools_warns() {
        let body = "Status: !`git status`\n\n```!\nls\n```\n";
        let all = found("", body, &[]);
        let injected = one(&all, "SK20");
        assert_eq!(injected.verdict(), Verdict::Warn);
        assert!(
            injected
                .message()
                .starts_with("command injection at line 5, 7 and no")
        );
        let allowed = "allowed-tools: Bash(git status) Bash(ls)\n";
        assert_eq!(verdict(allowed, body, &[], "SK20"), Verdict::Pass);
        assert_eq!(
            verdict("", "Wow!`x` and a!`b`\n", &[], "SK20"),
            Verdict::Pass
        );
    }

    #[test]
    fn the_injection_mark_needs_whitespace_or_a_line_start() {
        assert!(injects("!`pwd`"));
        assert!(injects("| cell | !`pwd` |"));
        assert!(injects("  ```!"));
        assert!(!injects("done!`pwd`"));
        assert!(!injects("```sh"));
    }
}
