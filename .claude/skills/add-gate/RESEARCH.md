# Sourcing agent behavior

## Claude Code

- Docs as markdown: `https://code.claude.com/docs/en/<page>.md` (`memory`, `skills`,
  `settings`, `mcp`, `hooks`, `sub-agents`, `permissions`); the index is
  `https://code.claude.com/docs/llms.txt`.
- For a question that spans pages, use the `claude-code-guide` agent and ask it to quote
  the text and mark what it could not confirm.

## OpenCode

The opencode.ai/docs pages describe V1. The source of truth is the V2 code:

```sh
gh api repos/anomalyco/opencode/commits/dev --jq .sha                     # the commit to cite
gh api "repos/anomalyco/opencode/git/trees/dev?recursive=1" --jq '.tree[].path' \
  | grep -iE '<topic>'                                                     # find the files
gh api "repos/anomalyco/opencode/contents/<path>?ref=dev" \
  -H "Accept: application/vnd.github.raw" > <scratchpad>/<file>            # read one
```

Start under `packages/core/src` (`config/`, `tool/plugin/`, `session/`, `skill*`, `mcp/`,
`permission*`). Code search (`gh api "search/code?q=<term>+repo:anomalyco/opencode"`)
finds callers.

## Empirical check (Claude Code)

When the docs leave a doubt, or a probe rests on one sentence, run the real binary on a
scratch repository holding the fixture, and read what the session loaded from its init
event:

```sh
cd <scratchpad>/probe && git init -q     # the fixture: files where the agent may look
claude -p "Reply with ok." --output-format stream-json --verbose --max-turns 1 \
  | python3 -c 'import json,sys
for l in sys.stdin:
    e=json.loads(l)
    if e.get("type")=="system" and e.get("subtype")=="init":
        print({k: e.get(k) for k in ("claude_code_version", "skills", "slash_commands",
               "agents", "plugins", "mcp_servers", "tools")})'
```

Record `claude_code_version` as the source. The event lists skills, commands, agents,
plugins, MCP servers, and tools; it does not list the instruction files loaded
(`memory_paths` is the auto-memory directory only). Billed: keep the prompt trivial and
run it once per question.

## Existing tools

ADR 0006 catalogs the scanners per pillar. Record each maintained one that covers part of the
gate under "Not probed yet" in the gate's ADR section, as the later integration PR.
Re-measure its freshness before citing it (ADR 0006: the snapshot status, and "Re-run the freshness gate").
