import { ccToOc, type OcPerm } from "../core/harmonize/perm-cc.ts";
import { ccPerms, ocPerms, ocToRules, type MergeOut } from "../core/harmonize/perm-apply.ts";
import type { Json } from "./read.ts";

const EFFECTS = ["allow", "deny", "ask"] as const;
const pick = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
const isPerm = (p: OcPerm): boolean =>
  typeof p?.action === "string" && typeof p?.resource === "string" && typeof p?.effect === "string";

// Claude Code settings -> OpenCode config. A rule with no OpenCode form is
// named, never dropped silently. A `permission` that is not an array (the
// agent frontmatter map form) is named and left untouched: a mixed shape
// would break the config.
export function permToOc(settings: Json, config: Json, prev: string[]): MergeOut {
  const perms = (settings["permissions"] as Json | undefined) ?? {};
  const add: OcPerm[] = [];
  const warnings: string[] = [];
  for (const effect of EFFECTS)
    for (const rule of pick(perms[effect])) {
      const oc = ccToOc(rule, effect);
      if (oc === null) warnings.push(`permission ${rule} has no OpenCode form`);
      else add.push(oc);
    }
  if (config["permission"] !== undefined && !Array.isArray(config["permission"]))
    return {
      mine: [],
      warnings: [...warnings, "opencode.json permission is not an array, left untouched"],
    };
  return { mine: ocPerms(config, prev, add), warnings };
}

// OpenCode config -> Claude Code settings
export function permToCc(config: Json, settings: Json, prev: string[]): MergeOut {
  const raw = config["permission"];
  if (!Array.isArray(raw))
    return {
      mine: [],
      warnings: raw === undefined ? [] : ["permission is not an array, left untouched"],
    };
  const perms: OcPerm[] = raw.map((p) => p as OcPerm);
  const valid = perms.filter((p) => isPerm(p));
  const bad = perms
    .filter((p) => !isPerm(p))
    .map((p) => `permission entry ${JSON.stringify(p)} has no Claude Code form`);
  return { mine: ccPerms(settings, prev, ocToRules(valid)), warnings: bad };
}
