// Claude Code permission rule -> OpenCode v2 rules {action, resource, effect}.
// `Bash(git:*)` -> shell `git *`, `Read(./p)` -> read `p`, `WebFetch(domain:d)`
// -> webfetch `https://d/*` and `http://d/*`, `mcp__s__t` -> `s_t`.
import { ccToOcPath } from "./perm-path.ts";
import { CC_TO_OC, mcpAction } from "./tools.ts";
import type { Effect } from "./wildcard.ts";

export type OcPerm = { action: string; resource: string; effect: Effect };
export type Converted = { resources: string[]; lossy: string | null };
const RULE = /^([^()\s]+)(?:\((.*)\))?$/s;

const shell = (spec: string): string => (spec.endsWith(":*") ? `${spec.slice(0, -2)} *` : spec);

function resources(action: string, spec: string, effect: Effect): Converted | null {
  if (action === "shell") return { resources: [shell(spec)], lossy: null };
  if (action === "read" || action === "edit") return { resources: [ccToOcPath(spec)], lossy: null };
  if (action !== "webfetch" || spec === "*") return { resources: [spec], lossy: null };
  if (!spec.startsWith("domain:")) return null;
  const domain = spec.slice(7);
  return {
    resources: [`https://${domain}/*`, `http://${domain}/*`],
    lossy:
      domain.includes("*") && effect !== "deny"
        ? `WebFetch(${spec}): in OpenCode * also crosses /, the rule matches more URLs`
        : null,
  };
}

export function ccToOc(
  rule: string,
  effect: Effect,
): { perms: OcPerm[]; lossy: string | null } | null {
  const match = RULE.exec(rule.trim());
  if (match === null) return null;
  const tool = match[1] ?? "";
  const spec = match[2] === undefined || match[2] === "" ? "*" : match[2];
  const action = tool.startsWith("mcp__") ? mcpAction(tool) : CC_TO_OC[tool];
  if (action === undefined || action === null) return null;
  const out = resources(action, spec, effect);
  if (out === null) return null;
  return {
    perms: out.resources.map((resource) => ({ action, resource, effect })),
    lossy: out.lossy,
  };
}
