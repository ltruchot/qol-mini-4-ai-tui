# Tab marker regression — top priority

Observed live, Claude Code, VS Code terminal list, kit installed from 0.5.0
(`install --replace`):

- A turn ending on a question (`Je l'applique ?`) left the tab green, not red.
- Earlier: orange where red was expected, green where orange was expected.
  The kit paints three states only (green, red, yellow): "orange" is the
  yellow marker or something else painting the title — to identify first.

## Lead to check first

- The 0.5.0 kit fix made `SubagentStop -> tab-state working` paint green
  despite `agent_id` (`src/kit/hooks/tab-rules.ts`, `src/kit/wire.ts`).
- Claude Code hooks reference (`code.claude.com/docs/en/hooks.md`, section
  SubagentStop): Claude Code runs internal agents (prompt suggestions,
  `/btw` side questions; the away-summary "recap" line is a candidate) and
  SubagentStop fires when one finishes, after the turn's `Stop`. For those,
  `agent_type` is the session's own agent name, or an empty string.
- So a late internal SubagentStop repaints green over the red or yellow the
  turn's `Stop` set. Fits both symptoms.

## How to check

- `claude --debug`, end a turn on a question, read
  `~/.claude/debug/<session-id>.txt`: the order of `Stop` and `SubagentStop`,
  and the `agent_type` of the late one.
- Instrument the installed `~/.claude/hooks/tab-state.mjs` (re-read on each
  call, no restart), log event name, `agent_type`, `agent_id`, state painted.

## Fix direction, once confirmed

- Paint green on SubagentStop only for a subagent the main thread spawned
  and is waiting on; never after the turn's `Stop`. Candidates: skip when
  `agent_type` is empty or is the session's own agent; or drop SubagentStop
  from the green events and rely on `PostToolBatch` of the main thread.
- Then the "orange": check the OpenCode plugin does not paint a Claude Code
  tab (`opencode/tui.js`, `shared.js` write to `/dev/tty`), and that only
  one marker emitter runs per event (`kit/wire.ts`).
- Test end to end with a SubagentStop payload carrying an empty
  `agent_type` after a `Stop`; update CLAUDE.md "When green is set".
