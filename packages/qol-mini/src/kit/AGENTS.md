# The global kit: hooks, installer, status line

Sources: `packages/qol-mini/src/kit/` (`hooks/` holds the delivered scripts). The
OpenCode faces of the same features are ruled in `packages/qol-mini/opencode/AGENTS.md`.

## Hook output

- `terminalSequence` is a **root** field. Inside `hookSpecificOutput` it is ignored
  with no error. Keep the test that requires it at the root.
- Only OSC 0/1/2/9/99/777 and BEL pass. One byte outside the allowlist drops the
  whole field silently: strip control characters from anything interpolated.
- A sequence ends in BEL or ST — ours ends in ST: some terminals ring on a BEL
  terminator, one beep per title set.
- It is applied in interactive sessions only, never under `-p` or the Agent SDK.
- A hook has no terminal: `/dev/tty` is unreachable. `terminalSequence` is the only
  way to write to it.
- Stdout on `UserPromptSubmit` that is not strict JSON is injected into the
  conversation. Print JSON or nothing.
- When behavior contradicts the published schema, trust the behavior and read the
  binary with `grep -a`. Without `-a`, grep reports nothing on a binary.

## The tab marker needs three things, and none reports its absence

1. `"terminal.integrated.tabs.title": "${sequence}"` in the editor.
2. `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` in the `env` block: Claude Code redraws its
   own title continuously and wins otherwise.
3. The root-level `terminalSequence`.

- The marker is a character in the tab name. The tab icon and its color cannot be
  set: only the extension that creates a terminal can, at creation.
- No animation: hooks fire on events, not on a clock.
- No "session ended" state: nobody sees it. `SessionEnd` stays in `EVENTS` with no
  handler, so the purge clears it from any config.
- `${sequence}` retitles every terminal, a shell tab included. Hence
  `--tab-state` is opt-in, and `qol-mini vscode --revert` exists.

## A project opts out with a file

- Hook entries merge across settings levels and no project file removes one of
  ours: `disableAllHooks` in a project takes that project's own hooks down too.
  So each script asks the question itself.
- `<project>/.claude/qol-mini-off`, empty: `precompact-kaizen`, `tab-state` and
  `play` do nothing there, from any depth below it. The walk up stops
  below `$HOME`, so a stray file in the home directory silences nothing.
- The file can name features, split on spaces or commas: `kaizen`, `tab`, `sounds`.
  Then only those are off. Every hook passes its own feature to `optedOut()`.
- With `kaizen` off and `tab` on, `precompact-kaizen --marker` still emits green on
  `PreCompact`: it is the only emitter registered there.
- Skills are outside the opt-out: nothing of theirs runs in a hook.
- The status line is not in the opt-out: a project that wants another one sets
  `statusLine` in its own settings, which outranks ours.

## PreCompact hands the agent nothing

- `exit 2` blocks the compaction and shows stderr to the **user** only. It never
  reaches the conversation.
- `PreCompact` accepts no `additionalContext`. `PostCompact` has no decision control.
- So stderr is two lines addressed to a human, naming `/kaizen`. The review lives in
  the skill, never in the hook.
- Read the exit-code table by row: stderr goes to the agent on `PreToolUse`, `Stop`,
  `PostToolUse`, not on `PreCompact`, `SessionStart`, `SubagentStart`,
  `PostModelSwitch`.
- Automatic compaction is never blocked, and no review is possible on it.
- `SessionStart` with matcher `compact` is the only channel to the agent after a
  compaction, manual or automatic. `precompact-kaizen --after-compact` uses it
  to name `TODO.md`, and emits no marker: `tab-state` owns `SessionStart`,
  under matcher `startup|resume|clear` only — an automatic compaction happens
  mid-turn, and yellow there would hide a working model.
- The release token is keyed on the working directory, not the session: the
  skill writes it from a plain shell, a manual `/kaizen` arms the next `/compact`,
  and one project's review does not release another's.

## One marker per event

- Hooks on one event run concurrently and each sequence is applied: two markers on
  one event race. Register one `terminalSequence` emitter per event.
- `PreCompact` belongs to `precompact-kaizen`, the only hook that knows whether
  compaction runs: green if it passes, red if held back. It emits `hookOutput()`
  under `--marker`. Without kaizen, `tab-state` takes `PreCompact`; without the
  marker, no `--marker`.
- On the blocking path the sequence is applied before the exit status is read.
- `PostCompact` matches `manual` only: an automatic compaction happens mid-turn.

## When green is set

- No event fires when the model starts thinking. Reclaim green on `UserPromptSubmit`,
  `PostToolBatch` and `SubagentStop`, the last moments before work resumes.
- Subagents fire `PostToolBatch` on their own loop, after the main thread's `Stop`.
  Only the main thread paints green: skip `working` when `agent_id` or `agent_type`
  is present, except on `SubagentStop`, which always carries both: it is the
  orchestrator resuming. Red from a subagent stays.
- Internal agents (prompt suggestions, `/btw`) fire `SubagentStop` after the
  turn's `Stop`, with `agent_type` empty: no green there, or it paints over red.
- `Stop` with a non-empty `background_tasks` or `session_crons` stays green and
  silent: the session wakes itself. The registry can lag by one task at the instant
  it settles; do not treat it as exact.

## When red is set

- `PermissionRequest` fires when the dialog appears; `permission_prompt` fires only
  after about six seconds without a keystroke. Red rides `PermissionRequest`; the
  sound keeps `Notification`, so it does not ring at someone already looking.
- A turn ending on a question is a plain `Stop`. Rule: the last non-empty line of
  `last_assistant_message`, stripped of markdown emphasis and closing brackets, ends
  with `?` → red and `needs-you`. Background work outranks it. Keep it that narrow.
- `idle_prompt` fires a minute after `Stop`, with no `last_assistant_message`:
  `tab-state` reads the newest main-thread text from the transcript
  (`kit/hooks/last-text.ts`), or yellow paints over that red.
- Wired from the reference, not observed: `quota_auto_resume_stale` and
  `quota_auto_resume_disabled` red with sound, `quota_auto_resume_fired` green,
  `StopFailure` red without sound. If one misbehaves, unwire it in `kit/wire.ts`.

## Nothing fires when a turn is cut short

- Esc, or refusing a permission, emits no hook. The marker holds until the next
  prompt. This is a known gap.
- `idle_prompt` does not rescue it: an interrupt leaves the last completion time
  untouched, and the idle check returns on exactly that.
- Not usable: `StopFailure` (API errors only), `PermissionDenied` (auto-mode
  classifier only), the status line (runs on a clock but cannot write to the
  terminal).
- Open: `PostToolUseFailure.is_interrupt` may fire when a running tool is aborted.
  Unmeasured, and it would cover that one case only.
- A transcript watcher per session would close the gap. It is a process on a clock,
  which this kit does not carry.

## Installer

- Hooks use exec form: `{"type": "command", "command": <node>, "args": [<script>,
  <arg>]}`. The interpreter is `process.execPath`. No shell string, no Git Bash.
  Under a version manager that path is tied to one Node version: running
  `install` again rewrites it. Why not a bare `node`: `docs/adr/0002-hooks-run-an-absolute-node.md`.
- A `dlx` run lives in a temporary cache: the hooks are copied into the config dir,
  never referenced in the package. Each one is a standalone bundle, built from its
  own `pack` entry so no chunk is shared, and named `.mjs`: a bare `.js` with no
  `package.json` beside it is not read as an ES module.
- The installer reads the bundles from `dist/`: build before `install` from a clone.
- Every delivered file is created if missing, left if identical, and if different
  **nothing at all is written** and the files are named. `--replace` overwrites.
  One exception: a file that differs only by the quoted node path (the kaizen
  `SKILL.md` names `process.execPath`) is rewritten without `--replace`.
- `settings.json` is written, with a `.bak-` copy, only when the merge changes it.
  Same for `uninstall`. Every config write is a temp file then a rename
  (`writeFileAtomic`); a symlinked file is written at its target.
- `uninstall` cleans `settings.json` and `cli.json` before it removes a file: a
  config that fails to parse stops it with every hook still pointing at its
  script. A sound or the kaizen `SKILL.md` that differs from what install
  delivers is kept and named.
- Sound files are never regenerated: users drop their own.
- Options overlay `installedState()`: `--replace` alone keeps the installed options.
  With nothing of ours in `settings.json`, the base is the defaults. `--defaults` is
  the only reset. Each feature has both flags.
- The installer purges its own handlers before adding the enabled ones.
  `withoutOurs()` is shared with `uninstall`. `OURS` matches a script without its
  extension, so a handler on a `.py` or `.sh` copy goes too. When a delivered file is
  renamed, add the old name to `OURS` and `SUPERSEDED`.
- Superseded files are removed last, after `settings.json` is written. A running
  session reloads hooks through a file watcher, after a delay: until then it calls
  the handlers it holds, on files that are gone. `install` says so when it removes one.
- A restart is named in two cases only: the `env` block changed, or `skills/` did
  not exist before the run.
- An editor `settings.json` is JSONC: insert the key textually, never parse and
  reserialize.

## Status line

- The gauge and the fraction share one denominator, the alert threshold, not the
  window: on a 1M model a window-relative bar is near empty when the alert matters.
- The unit sits on the denominator only: `0k/200k` reads as "Ok".
- `effort.level` follows the model, absent when the model takes no effort.
- The config dir closes the line only when `CLAUDE_CONFIG_DIR` is not
  `~/.claude`: a wrapper that relocates it runs its own install, and the line
  names which one is live. The status line inherits Claude Code's environment.

## Method

- Instrument the installed copy in `~/.claude/hooks/`: scripts are re-read on each
  call, so a probe works without restart. Reinstall with `--replace` after.
- A hook that returns `additionalContext` leaves no transcript entry and no
  terminal output. Running it by hand proves the script, not the wiring: for
  that, start with `claude --debug` and read `~/.claude/debug/<session-id>.txt`.
- Wake another session with `SendMessage` to make its hooks fire.
- `/proc/PID/environ` cannot show a variable set by `settings.json`.
