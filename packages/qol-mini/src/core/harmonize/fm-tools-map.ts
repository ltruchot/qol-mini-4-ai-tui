// Command tool names, Claude Code -> OpenCode. OpenCode keeps a map of
// tool -> bool|pattern; a Claude Code `Bash(git:*)` narrows to `bash: true`
// and is named in `lossy` because the pattern itself has no place to live.
export const CC_TO_OC: Record<string, string> = {
  Read: "read",
  Edit: "edit",
  Write: "edit",
  Glob: "glob",
  Grep: "grep",
  Bash: "bash",
  WebFetch: "webfetch",
  WebSearch: "websearch",
  Skill: "skill",
  SlashCommand: "command",
  AskUserQuestion: "question",
  Task: "task",
  TodoWrite: "todowrite",
};

export const ocToCcName = (oc: string): string | undefined =>
  Object.entries(CC_TO_OC).find(([, o]) => o === oc)?.[0];

// Claude Code holds `allowed-tools` as a list or a CSV string
export function parseAllowed(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || value.trim() === "") return [];
  return value.split(",").map((s) => s.trim());
}
