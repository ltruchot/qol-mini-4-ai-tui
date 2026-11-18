# The gate's pull request

Confirm with the user before pushing. Then:

```sh
git push -u origin gate/<id>
gh pr create --draft --base main --title "Add the <id> gate" --body-file <scratchpad>/pr-<id>.md
```

The body, in this order:

```markdown
## Summary

<the gate, its pillar, and what it catches for each agent, in two or three lines>

## Probes

<the probe table from ADR 0008>

## Sources

<each behavior claim, with its docs URL, OpenCode commit and file, or empirical run>

## Tests

<counts per level (unit, real tree, container), and the `cargo xtask check` result>

## Not verified

<everything that is not proven, and what is not probed yet>
```

End the body with the PR attribution lines from the session instructions.

Call the Skill tool with `code-review` on the PR number. Fix each confirmed finding in a
new commit on the branch, never with an amend or a rebase once the PR is open.
