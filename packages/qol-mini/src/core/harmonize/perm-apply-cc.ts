import type { CcRule } from "./perm-oc.ts";

type Json = Record<string, unknown>;
const EFFECTS = ["allow", "deny", "ask"] as const;

// Claude Code: allow/deny/ask arrays under `permissions`
export function ccPerms(settings: Json, prev: string[], add: CcRule[]): string[] {
  const perms = (settings["permissions"] as Json | undefined) ?? {};
  settings["permissions"] = perms;
  const mine: string[] = [];
  for (const effect of EFFECTS) {
    const raw = perms[effect];
    const current = Array.isArray(raw) ? (raw as string[]) : [];
    const kept = current.filter((r) => !prev.includes(r));
    const fresh = [
      ...new Set(
        add.filter((r) => r.effect === effect && !kept.includes(r.rule)).map((r) => r.rule),
      ),
    ];
    if (fresh.length > 0 || kept.length !== current.length) {
      const next = [...kept, ...fresh];
      if (next.length === 0) Reflect.deleteProperty(perms, effect);
      else perms[effect] = next;
    }
    mine.push(...fresh);
  }
  if (Object.keys(perms).length === 0) Reflect.deleteProperty(settings, "permissions");
  return mine;
}
