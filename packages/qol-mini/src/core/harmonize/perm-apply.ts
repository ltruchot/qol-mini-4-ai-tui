// Merge our permission entries in and out of parsed configs. `prev` holds the
// keys a previous run wrote: a re-run removes ours, keeps the user's, adds the
// fresh ones, and reports the new owned set.
import type { OcPerm } from "./perm-cc.ts";
import { byEffect } from "./perm-order.ts";

type Json = Record<string, unknown>;

export const permKey = (p: OcPerm): string => `${p.action}|${p.resource}|${p.effect}`;

// OpenCode: the native `permissions` array. Ours go first, allow -> ask ->
// deny: the user's own entries come after them and keep the last word.
export function ocPerms(config: Json, prev: string[], add: OcPerm[]): string[] {
  const raw = config["permissions"];
  const current = Array.isArray(raw) ? (raw as OcPerm[]) : [];
  const kept = current.filter((p) => !prev.includes(permKey(p)));
  const seen = new Set(kept.map(permKey));
  const fresh: OcPerm[] = [];
  for (const p of byEffect(add))
    if (!seen.has(permKey(p))) {
      seen.add(permKey(p));
      fresh.push(p);
    }
  const next = [...fresh, ...kept];
  if (next.length === 0) Reflect.deleteProperty(config, "permissions");
  else if (JSON.stringify(next) !== JSON.stringify(current)) config["permissions"] = next;
  return fresh.map(permKey);
}
