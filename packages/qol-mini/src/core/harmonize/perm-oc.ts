// OpenCode {action, resource, effect} -> Claude Code permission rule
// shell "git *" -> `Bash(git:*)`, read/edit keep their path, webfetch "https://d/*"
// -> `WebFetch(domain:d)`. Unknown actions stay unconverted.
import type { OcPerm } from "./perm-cc.ts";

export function ocToCc(perm: OcPerm): { rule: string; effect: "allow" | "deny" | "ask" } | null {
  let rule: string | null = null;
  if (perm.action === "shell") rule = `Bash(${shellSpec(perm.resource)})`;
  else if (perm.action === "read") rule = `Read(${perm.resource})`;
  else if (perm.action === "edit") rule = `Edit(${perm.resource})`;
  else if (perm.action === "webfetch") rule = `WebFetch(${domainSpec(perm.resource)})`;
  return rule === null ? null : { rule, effect: perm.effect };
}

function shellSpec(resource: string): string {
  return resource.endsWith(" *") ? `${resource.slice(0, -2)}:*` : resource;
}

function domainSpec(resource: string): string {
  const match = /^https:\/\/([^/*]+)\/\*$/.exec(resource);
  return match === null ? resource : `domain:${match[1] ?? ""}`;
}
