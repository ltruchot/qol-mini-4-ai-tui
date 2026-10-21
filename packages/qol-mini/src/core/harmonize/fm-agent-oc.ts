// OpenCode agent frontmatter, native or legacy -> Claude Code. Rules are read
// in OpenCode's order; a tool's effect is the last rule matching it. With a
// catch-all deny the agent lists its allowed tools, else its denied ones.
import { COLORS, plain, unknownKeys, type Fm } from "./fm-agent-map.ts";
import { toCcModel } from "./model.ts";
import { readOcRules } from "./perm-read.ts";
import { OC_TO_CC } from "./tools.ts";
import { matches } from "./wildcard.ts";

const KNOWN = ["description", "mode", "model", "steps", "maxSteps", "color"];
const RULES = ["permissions", "permission", "tools"];

function tools(data: Record<string, unknown>, lossy: string[]): Record<string, string[]> {
  const { legacy, native } = readOcRules(data);
  const all = [...legacy, ...native];
  for (const r of all.filter((p) => p.resource !== "*"))
    lossy.push(`${r.effect} ${r.action} "${r.resource}": a pattern has no agent form`);
  const effect = (action: string): string =>
    all.findLast((p) => p.resource === "*" && matches(action, p.action))?.effect ?? "allow";
  const closed = all.some((p) => p.action === "*" && p.effect === "deny");
  const pick = (want: string): string[] =>
    Object.entries(OC_TO_CC)
      .filter(([oc]) => effect(oc) === want)
      .map(([, cc]) => cc);
  for (const tool of pick("ask")) lossy.push(`${tool}: ask has no agent form`);
  return closed ? { tools: pick("allow") } : { disallowedTools: pick("deny") };
}

export function ocToCcAgent(data: Record<string, unknown>, stem: string): Fm | null {
  if (data["disabled"] === true || data["disable"] === true) return null;
  const lossy = unknownKeys(data, [...KNOWN, ...RULES], "Claude Code");
  const fm: Record<string, unknown> = { name: stem, description: data["description"] };
  if (typeof data["description"] !== "string") lossy.push("no description: Claude Code skips it");
  for (const [key, list] of Object.entries(tools(data, lossy))) if (list.length > 0) fm[key] = list;
  const model = plain(data["model"]);
  if (model !== null) fm["model"] = toCcModel(model) ?? undefined;
  if (model !== null && fm["model"] === undefined) lossy.push(`model ${model}`);
  const steps = data["steps"] ?? data["maxSteps"];
  if (typeof steps === "number") fm["maxTurns"] = steps;
  const color = plain(data["color"]);
  const named = Object.entries(COLORS).find(([, hex]) => hex === color?.toLowerCase())?.[0];
  if (named !== undefined) fm["color"] = named;
  else if (color !== null) lossy.push(`color ${color}`);
  if (data["mode"] === "primary") lossy.push("mode primary has no Claude Code subagent form");
  return { data: fm, lossy };
}
