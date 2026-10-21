import { ccToOc, type OcPerm } from "../core/harmonize/perm-cc.ts";
import { ocToCc, type CcRule } from "../core/harmonize/perm-oc.ts";
import { ocPerms } from "../core/harmonize/perm-apply.ts";
import { ccPerms } from "../core/harmonize/perm-apply-cc.ts";
import { exceptions, weakens } from "../core/harmonize/perm-order.ts";
import { readOcRules } from "../core/harmonize/perm-read.ts";
import type { Json } from "./read.ts";
import type { MergeOut } from "./plan-io.ts";

const EFFECTS = ["allow", "ask", "deny"] as const;
const pick = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
const UNCONVERTED = ["defaultMode", "additionalDirectories"];

// Claude Code settings -> the native `permissions` array of opencode.json. A
// rule with no OpenCode form is named, never dropped silently. OpenCode reads
// a legacy `permission` map before that array: a converted rule that would
// override a stricter legacy rule is a conflict until --replace.
export function permToOc(settings: Json, config: Json, prev: string[], replace: boolean): MergeOut {
  const perms = (settings["permissions"] as Json | undefined) ?? {};
  const add: OcPerm[] = [];
  const warnings = UNCONVERTED.filter((k) => k in perms).map((k) => `permissions.${k}: no form`);
  for (const effect of EFFECTS)
    for (const rule of pick(perms[effect])) {
      const oc = ccToOc(rule, effect);
      if (oc === null) warnings.push(`permission ${rule} has no OpenCode form`);
      else add.push(...oc.perms);
      if (typeof oc?.lossy === "string") warnings.push(oc.lossy);
    }
  const { legacy, bad } = readOcRules(config);
  warnings.push(...bad.map((b) => `opencode.json ${b}: not a permission rule`));
  const weaker = weakens(legacy, add).map((w) => `opencode.json legacy permission: ${w}`);
  if (weaker.length > 0 && !replace) return { mine: [], warnings, conflicts: weaker };
  warnings.push(...weaker);
  return { mine: ocPerms(config, prev, add), warnings };
}

// OpenCode config -> Claude Code settings, every rule in evaluation order
export function permToCc(config: Json, settings: Json, prev: string[]): MergeOut {
  const { legacy, native, bad } = readOcRules(config);
  const all = [...legacy, ...native];
  const warnings = [...bad.map((b) => `${b}: not a permission rule`), ...exceptions(all)];
  const rules: CcRule[] = [];
  for (const perm of all) {
    const cc = ocToCc(perm);
    if (cc === null)
      warnings.push(`permission ${perm.action} "${perm.resource}" has no Claude Code form`);
    else rules.push(cc);
  }
  return { mine: ccPerms(settings, prev, rules), warnings };
}
