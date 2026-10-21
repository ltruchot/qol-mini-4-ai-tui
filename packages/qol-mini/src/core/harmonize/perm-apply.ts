// Merge our permission entries in and out of parsed configs. `prev` holds the
// keys a previous run wrote: a re-run removes ours, keeps the user's, adds the
// fresh ones, and reports the new owned set.
import type { OcPerm } from "./perm-cc.ts";
import { ocToCc } from "./perm-oc.ts";

type Json = Record<string, unknown>;
export type CcRule = { rule: string; effect: "allow" | "deny" | "ask" };
export type MergeOut = { mine: string[]; warnings: string[] };
const EFFECTS = ["allow", "deny", "ask"] as const;

export const permKey = (p: OcPerm): string => `${p.action}|${p.resource}|${p.effect}`;

// OpenCode: a `permission` array on the config
export function ocPerms(config: Json, prev: string[], add: OcPerm[]): string[] {
  const raw = config["permission"];
  const current = Array.isArray(raw) ? (raw as OcPerm[]) : [];
  const kept = current.filter((p) => !prev.includes(permKey(p)));
  const fresh = add.filter((p) => !kept.some((k) => permKey(k) === permKey(p)));
  if (fresh.length > 0 || kept.length !== current.length)
    config["permission"] = [...kept, ...fresh];
  return fresh.map(permKey);
}

// Claude Code: allow/deny/ask arrays under `permissions`
export function ccPerms(settings: Json, prev: string[], add: CcRule[]): string[] {
  const perms = (settings["permissions"] as Json | undefined) ?? {};
  settings["permissions"] = perms;
  const mine: string[] = [];
  for (const effect of EFFECTS) {
    const raw = perms[effect];
    const current = Array.isArray(raw) ? (raw as string[]) : [];
    const kept = current.filter((r) => !prev.includes(r));
    const fresh = add
      .filter((r) => r.effect === effect && !kept.includes(r.rule))
      .map((r) => r.rule);
    if (fresh.length > 0 || kept.length !== current.length) {
      const next = [...kept, ...fresh];
      if (next.length === 0) Reflect.deleteProperty(perms, effect);
      else perms[effect] = next;
    }
    mine.push(...fresh);
  }
  return mine;
}

export const ocToRules = (perms: OcPerm[]): CcRule[] =>
  perms.map(ocToCc).filter((r): r is CcRule => r !== null);
