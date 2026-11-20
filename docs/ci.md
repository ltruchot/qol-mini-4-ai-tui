# CI

`.github/workflows/test.yml` runs on every push and pull request. A push is done when its
`test` run is green: `gh run watch <id> --exit-status`.

| Case | Do |
|---|---|
| a job cancelled with `not acquired by Runner` | GitHub runner capacity, not the change: `gh run rerun <id> --failed` |
| a job failed while the run still goes | `gh run view --log-failed` prints nothing until the run ends: `gh api repos/ltruchot/qol-mini-4-ai-tui/actions/jobs/<job>/logs --allow-escape-sequences`, the job id from `gh run view <id> --json jobs` |
| `test-windows` red | the job is `continue-on-error`: the suite holds POSIX assumptions (file modes, `/` paths). Compare its `FAIL` lines with the last run on `main`; only a new one is the change's |
| a push to a pull request branch | two runs start, `push` and `pull_request`; the concurrency group cancels the older one |
