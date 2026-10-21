// OpenCode v2 rule -> Claude Code permission rule. shell `git *` ->
// `Bash(git *)`, read/edit keep their path, webfetch `https://d/*` ->
// `WebFetch(domain:d)`. An action Claude Code has no tool for stays unconverted.
import type { OcPerm } from "./perm-cc.ts";
import { ocToCcPath } from "./perm-path.ts";
import { OC_TO_CC } from "./tools.ts";
import type { Effect } from "./wildcard.ts";

export type CcRule = { rule: string; effect: Effect };

function spec(action: string, resource: string): string | null {
  if (resource === "*") return "";
  if (action === "read" || action === "edit") return ocToCcPath(resource);
  if (action !== "webfetch") return resource;
  const match = /^https?:\/\/([^/]+)\/\*$/.exec(resource);
  return match === null ? null : `domain:${match[1] ?? ""}`;
}

export function ocToCc(perm: OcPerm): CcRule | null {
  const tool = OC_TO_CC[perm.action];
  if (tool === undefined) return null;
  const inner = spec(perm.action, perm.resource);
  if (inner === null) return null;
  return { rule: inner === "" ? tool : `${tool}(${inner})`, effect: perm.effect };
}
