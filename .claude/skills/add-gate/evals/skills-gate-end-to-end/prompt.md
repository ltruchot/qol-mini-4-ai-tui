---
tags: [add-gate]
max_turns: 400
timeout_seconds: 7200
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash, WebFetch, Agent]
---

Let's take on the next gate: the `skills` gate (pillar 2 of ADR 0005). Build it end to end, the way we did `agents-md`, on its own branch with one commit per layer, ready for a PR to code-review.
