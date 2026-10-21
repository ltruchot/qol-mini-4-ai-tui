// One tool table for permissions, agents and commands. Claude Code tool names
// map to OpenCode v2 permission actions; OpenCode keys its permissions by the
// tool name, MCP tools as `<server>_<tool>`.
export const CC_TO_OC: Record<string, string> = {
  Bash: "shell",
  Read: "read",
  Edit: "edit",
  Write: "edit",
  MultiEdit: "edit",
  NotebookEdit: "edit",
  Glob: "glob",
  Grep: "grep",
  WebFetch: "webfetch",
  WebSearch: "websearch",
  Agent: "subagent",
  Task: "subagent",
  Skill: "skill",
  TodoWrite: "todowrite",
  AskUserQuestion: "question",
};

// The Claude Code name that reads best for each OpenCode action
export const OC_TO_CC: Record<string, string> = {
  shell: "Bash",
  read: "Read",
  edit: "Edit",
  glob: "Glob",
  grep: "Grep",
  webfetch: "WebFetch",
  websearch: "WebSearch",
  subagent: "Agent",
  skill: "Skill",
  todowrite: "TodoWrite",
  question: "AskUserQuestion",
};

// Legacy OpenCode names, normalized the way OpenCode 2.1 does on load
export function ocAction(name: string): string {
  if (name === "write" || name === "patch") return "edit";
  if (name === "task") return "subagent";
  if (name === "bash") return "shell";
  return name;
}

// `mcp__github__create_issue` -> `github_create_issue`, a whole server -> `github_*`
export function mcpAction(tool: string): string | null {
  const [, server, name] = /^mcp__([^_]+(?:_[^_]+)*?)(?:__(.+))?$/.exec(tool) ?? [];
  if (server === undefined) return null;
  return name === undefined || name === "*" ? `${server}_*` : `${server}_${name}`;
}
