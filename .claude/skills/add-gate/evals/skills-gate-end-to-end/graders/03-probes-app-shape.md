---
type: llm
focus: trace
weight: 1
---

crates/skills-chkr has lib.rs with audit(root, Reach), main.rs with --repo-only, I/O only in snapshot.rs through vitals_utils::fs, and a skills-chkr alias in .cargo/config.toml.
