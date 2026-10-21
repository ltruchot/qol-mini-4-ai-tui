// Claude Code hook events -> what an OpenCode 2.1 plugin listens to: a bus
// event, or a `hooks.trigger(domain, name)` hook. Report only: a hook body is
// an arbitrary command, so the mapping names what a plugin must listen to.
export const HOOK_MAP: readonly [string, string][] = [
  ["SessionStart", "session.created"],
  ["SessionEnd", "session.deleted"],
  ["UserPromptSubmit", "hook session/prompt"],
  ["PreToolUse", "hook tool/execute.before"],
  ["PostToolUse", "hook tool/execute.after"],
  ["Notification", "tui.toast.show"],
  ["PermissionRequest", "permission.asked, hook permission/evaluate"],
  ["PreCompact", "session.compaction.started"],
  ["PostCompact", "session.compaction.ended"],
  ["SubagentStop", "session.idle (partial)"],
  ["Stop", "session.idle"],
];

export const NOT_PORTABLE = ["statusLine"];

export function hookTarget(event: string): string {
  return HOOK_MAP.find(([cc]) => cc === event)?.[1] ?? "no equivalent";
}
