// Claude Code agent -> OpenCode 2.1 native agent, native keys only. `tools`
// is an allowlist: `deny *`, one allow per tool. OpenCode reads an agent's
// rules after the project's: `guards`, the project's ask and deny rules, come
// again last, as Claude Code applies them to subagents too.
import { COLORS, parseList, plain, unknownKeys, type Fm } from "./fm-agent-map.ts";
import { toOcModel } from "./model.ts";
import { ccToOc, type OcPerm } from "./perm-cc.ts";

const KNOWN = ["name", "description", "tools", "disallowedTools", "model", "maxTurns", "color"];

function rules(data: Record<string, unknown>, lossy: string[]): OcPerm[] {
  const allow = parseList(data["tools"]);
  const out: OcPerm[] = allow.length > 0 ? [{ action: "*", resource: "*", effect: "deny" }] : [];
  for (const tool of allow) {
    const oc = ccToOc(tool, "allow");
    if (oc === null) lossy.push(`tool ${tool} has no OpenCode form`);
    else out.push(...oc.perms);
  }
  // Claude Code removes the whole tool even when the entry names a pattern
  for (const tool of parseList(data["disallowedTools"])) {
    const oc = ccToOc(tool.replace(/\(.*\)$/s, ""), "deny");
    if (oc === null) lossy.push(`disallowed tool ${tool} has no OpenCode form`);
    else out.push(...oc.perms);
  }
  return out;
}

export function ccToOcAgent(
  data: Record<string, unknown>,
  stem: string,
  guards: OcPerm[] = [],
): Fm {
  const lossy = unknownKeys(data, KNOWN, "OpenCode");
  const fm: Record<string, unknown> = { description: data["description"], mode: "subagent" };
  const name = plain(data["name"]);
  if (name !== null && name !== stem) lossy.push(`name ${name}: OpenCode names it ${stem}`);
  const model = plain(data["model"]);
  if (model !== null && model !== "inherit") {
    fm["model"] = toOcModel(model) ?? undefined;
    if (fm["model"] === undefined) lossy.push(`model ${model} has no provider/model form`);
  }
  const turns = data["maxTurns"];
  if (typeof turns === "number" && Number.isInteger(turns) && turns > 0) fm["steps"] = turns;
  const color = plain(data["color"]);
  if (color !== null) fm["color"] = COLORS[color] ?? undefined;
  if (color !== null && fm["color"] === undefined) lossy.push(`color ${color}`);
  const perms = rules(data, lossy);
  if (perms.length > 0) fm["permissions"] = [...perms, ...guards];
  return { data: fm, lossy };
}
