// Claude Code permission rule -> OpenCode {action, resource, effect}
// `Bash(git:*)` -> shell "git *", `Read(p)` -> read, `Edit/Write(p)` -> edit,
// `WebFetch(domain:d)` -> webfetch "https://d/*". A bare tool allows all: "*".
const RULE = /^([A-Za-z]+)(?:\((.*)\))?$/;

export type OcPerm = { action: string; resource: string; effect: "allow" | "deny" | "ask" };

type Tool = { action: string; fold?: (spec: string) => string };

const TOOLS: Record<string, Tool> = {
  Bash: { action: "shell", fold: (s) => (s.endsWith(":*") ? `${s.slice(0, -2)} *` : s) },
  Read: { action: "read" },
  Edit: { action: "edit" },
  Write: { action: "edit" },
  WebFetch: {
    action: "webfetch",
    fold: (s) => (s.startsWith("domain:") ? `https://${s.slice(7)}/*` : s),
  },
};

export function ccToOc(rule: string, effect: OcPerm["effect"]): OcPerm | null {
  const match = RULE.exec(rule.trim());
  if (match === null) return null;
  const tool = TOOLS[match[1] ?? ""];
  if (tool === undefined) return null;
  const spec = match[2] ?? "*";
  return {
    action: tool.action,
    resource: tool.fold === undefined ? spec : tool.fold(spec),
    effect,
  };
}
