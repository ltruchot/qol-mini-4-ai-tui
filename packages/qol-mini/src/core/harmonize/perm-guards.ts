// The project's ask and deny rules in OpenCode form, stricter last: what an
// agent's own allow rules must not override
import { ccToOc, type OcPerm } from "./perm-cc.ts";

export function guardsOf(settings: Record<string, unknown> | undefined): OcPerm[] {
  const perms = (settings?.["permissions"] ?? {}) as Record<string, unknown>;
  return (["ask", "deny"] as const).flatMap((effect) => {
    const list = perms[effect];
    return Array.isArray(list) ? list.flatMap((r) => ccToOc(String(r), effect)?.perms ?? []) : [];
  });
}
