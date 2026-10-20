# qol-mini

Minimal kit for [Claude Code](https://code.claude.com) and
[OpenCode](https://opencode.ai): a context gauge, sounds, a tab marker and a
review before `/compact` for every project; skills per project. One install
wires both agents.

```bash
pnpm dlx qol-mini install                              # global: hooks, status line, OpenCode plugin
pnpm dlx qol-mini skills install qa-pr ./my-project    # project: skills, read by both agents
pnpm dlx qol-mini --help
```

Node.js 22.18+. Documentation:
[github.com/ltruchot/qol-mini-4-ai-tui](https://github.com/ltruchot/qol-mini-4-ai-tui#readme).
