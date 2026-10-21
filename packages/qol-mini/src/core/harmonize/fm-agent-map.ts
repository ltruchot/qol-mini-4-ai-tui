// Shared pieces of the agent frontmatter conversion
export const CC_TO_OC: Record<string, string> = {
  Read: "read",
  Edit: "edit",
  Write: "write",
  Glob: "glob",
  Grep: "grep",
  Bash: "bash",
  WebFetch: "webfetch",
  WebSearch: "websearch",
  Skill: "skill",
  Task: "task",
  TodoWrite: "todowrite",
};

export type AgentFm = { data: Record<string, unknown>; lossy: string[] };

// Claude Code holds `tools` as a list or a CSV string
export function parseTools(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || value.trim() === "") return [];
  return value.split(",").map((s) => s.trim());
}

// A frontmatter value safe to interpolate: never an object
export function plain(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);
  return null;
}

export const ocToCcName = (oc: string): string | undefined =>
  Object.entries(CC_TO_OC).find(([, o]) => o === oc)?.[0];
