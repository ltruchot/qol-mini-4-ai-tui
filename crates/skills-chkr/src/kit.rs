//! The pairs the `qol-mini` kit keeps on purpose: a project copy of a bank skill,
//! recorded in the repository's lock, next to the kit's personal copy of the same skill.
//! `SK15` passes them (ADR 0008).

use serde_json::Value;
use vitals_utils::frontmatter;

/// The lock `qol-mini skills install` writes, relative to the repository root.
pub(crate) const LOCK: &str = ".claude/qol-mini.lock.json";

/// The `source` the lock records for a skill of the qol-mini bank.
const SOURCE: &str = "qol-mini";

/// Names of the skills `lock` records as installed from the qol-mini bank, sorted; none
/// when it does not parse.
pub(crate) fn managed(lock: &str) -> Vec<String> {
    let parsed: Value = serde_json::from_str(lock).unwrap_or(Value::Null);
    let mut names: Vec<String> =
        parsed
            .get("skills")
            .and_then(Value::as_object)
            .map_or_else(Vec::new, |skills| {
                skills
                    .iter()
                    .filter(|(_, entry)| {
                        entry.get("source").and_then(Value::as_str) == Some(SOURCE)
                    })
                    .map(|(name, _)| name.clone())
                    .collect()
            });
    names.sort();
    names
}

/// Whether two `SKILL.md` texts carry the same `name` and the same `description`: both
/// agents trigger the one skill, whichever copy runs.
pub(crate) fn same_skill(one: &str, other: &str) -> bool {
    let keys = |text: &str| {
        let front = frontmatter::read(text);
        ["name", "description"].map(|key| front.field(key).map(|field| field.value.clone()))
    };
    let mine = keys(one);
    mine.iter().all(Option::is_some) && mine == keys(other)
}

#[cfg(test)]
#[cfg_attr(coverage_nightly, coverage(off))]
mod tests {
    use super::{managed, same_skill};

    const KAIZEN: &str = "---\nname: kaizen\ndescription: Review the session.\n---\n# A\n";

    #[test]
    fn the_lock_names_the_bank_skills_only() {
        let lock = r#"{"version":1,"skills":{"z":{"source":"qol-mini"},"a":{"source":"qol-mini"},
            "other":{"source":"github"}}}"#;
        assert_eq!(managed(lock), ["a", "z"]);
        assert_eq!(managed("not json"), Vec::<String>::new());
        assert_eq!(managed(r#"{"version":1}"#), Vec::<String>::new());
    }

    #[test]
    fn one_skill_shares_name_and_description() {
        let body = KAIZEN.replace("# A", "# B, another release command");
        assert!(same_skill(KAIZEN, &body));
        assert!(!same_skill(KAIZEN, &KAIZEN.replace("Review", "Audit")));
        assert!(!same_skill("# no frontmatter\n", "# no frontmatter\n"));
    }
}
