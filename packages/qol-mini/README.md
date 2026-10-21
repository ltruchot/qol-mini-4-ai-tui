# qol-mini

Kit for [Claude Code](https://code.claude.com) and
[OpenCode](https://opencode.ai): hooks and a status line for every project,
skills per project, one repo harmonized for both agents. One install wires both
agents.

| Command | Scope | Does |
|---|---|---|
| `qol-mini install` | global | hooks, status line, sounds, tab marker, the kaizen review before `/compact`, the OpenCode plugin |
| `qol-mini skills install qa-pr ./my-project` | project | renders shipped skills into `.claude/skills/`, read by both agents; merges local edits on update |
| `qol-mini harmonize ./my-project` | repo | converts rules (`AGENTS.md`), permissions, commands, agents and MCP between the two agents |

```bash
pnpm dlx qol-mini install
pnpm dlx qol-mini --help
```

Node.js 22.18+. Documentation:
[github.com/ltruchot/qol-mini-4-ai-tui](https://github.com/ltruchot/qol-mini-4-ai-tui#readme).
