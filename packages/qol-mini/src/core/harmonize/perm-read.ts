// Every permission rule of an OpenCode config in OpenCode 2.1's evaluation
// order: legacy `tools`, legacy `permission`, native `permissions`. Last wins.
import type { OcPerm } from "./perm-cc.ts";
import { ocAction } from "./tools.ts";

type Json = Record<string, unknown>;
const EFFECTS = new Set(["allow", "deny", "ask"]);
const isEffect = (v: unknown): v is OcPerm["effect"] => typeof v === "string" && EFFECTS.has(v);
const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const rule = (action: string, resource: string, effect: OcPerm["effect"]): OcPerm => ({
  action: ocAction(action),
  resource,
  effect,
});

function legacy(value: unknown, bad: string[]): OcPerm[] {
  if (value === undefined) return [];
  if (isEffect(value)) return [rule("*", "*", value)];
  if (!isObject(value)) return (bad.push("permission is neither an effect nor a map"), []);
  return Object.entries(value).flatMap(([action, raw]) => {
    if (isEffect(raw)) return [rule(action, "*", raw)];
    if (!isObject(raw)) return (bad.push(`permission.${action} is not a map`), []);
    return Object.entries(raw).flatMap(([res, eff]) =>
      isEffect(eff) ? [rule(action, res, eff)] : (bad.push(`permission.${action}.${res}`), []),
    );
  });
}

function tools(value: unknown): OcPerm[] {
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([action, on]) =>
    typeof on === "boolean" ? [rule(action, "*", on ? "allow" : "deny")] : [],
  );
}

export function native(value: unknown, bad: string[]): OcPerm[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((p: Json) =>
    typeof p?.["action"] === "string" && typeof p["resource"] === "string" && isEffect(p["effect"])
      ? [rule(p["action"], p["resource"], p["effect"])]
      : (bad.push(`permissions entry ${JSON.stringify(p)}`), []),
  );
}

export function readOcRules(config: Json): { legacy: OcPerm[]; native: OcPerm[]; bad: string[] } {
  const bad: string[] = [];
  const old = [...tools(config["tools"]), ...legacy(config["permission"], bad)];
  return { legacy: old, native: native(config["permissions"], bad), bad };
}
