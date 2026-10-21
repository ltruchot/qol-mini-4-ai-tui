// Precedence between the two models. Claude Code: deny over ask over allow,
// whatever the order. OpenCode: the last matching rule wins.
import type { OcPerm } from "./perm-cc.ts";
import { matches, strictness } from "./wildcard.ts";

// Claude Code rules in an order OpenCode evaluates the same way: allow, then
// ask, then deny, so the stricter rule always comes last
export const byEffect = (perms: OcPerm[]): OcPerm[] =>
  perms.toSorted((a, b) => strictness(a.effect) - strictness(b.effect));

// Could both rules decide one call? Either pattern covers the other one: an
// approximation of "some input matches both", exact for prefix patterns.
const covers = (a: string, b: string): boolean => matches(a, b) || matches(b, a);
const overlaps = (later: OcPerm, earlier: OcPerm): boolean =>
  covers(earlier.action, later.action) && covers(earlier.resource, later.resource);

const show = (p: OcPerm): string => `${p.effect} ${p.action} "${p.resource}"`;

// Rules of `later` that override a stricter rule of `earlier`: placed after
// it, OpenCode would let through what the earlier rule held back
export function weakens(earlier: OcPerm[], later: OcPerm[]): string[] {
  const out: string[] = [];
  for (const l of later)
    for (const e of earlier)
      if (strictness(l.effect) < strictness(e.effect) && overlaps(l, e))
        out.push(`${show(l)} would override ${show(e)}`);
  return out;
}

// OpenCode exceptions Claude Code cannot express: a looser rule after a
// stricter one it overlaps. Claude Code applies the stricter one first.
export function exceptions(rules: OcPerm[]): string[] {
  return rules.flatMap((rule, i) =>
    weakens(rules.slice(0, i), [rule]).map((w) => `${w}; Claude Code keeps the stricter rule`),
  );
}
