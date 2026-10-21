import type { RuleMode, Side } from "../core/schema/harmony.ts";
import { toPure } from "./slice-rules-pure.ts";
import type { RulesState } from "../core/harmonize/rules.ts";
import type { Merged } from "../core/harmonize/rules-merge.ts";
import type { Intent } from "./plan-types.ts";

const BRIDGE: Intent = { op: "write", path: "CLAUDE.md" };
const LINK: Intent = { op: "symlink", path: "CLAUDE.md", to: "AGENTS.md" };

// Rule moves to reach `mode` from `state`. AGENTS.md is the canonical file in
// every mode; the modes differ in what CLAUDE.md becomes after the move.
export function planRules(
  state: RulesState,
  mode: RuleMode,
  replace: boolean,
  from: Side,
  merged: Merged | null = null,
): { intents: Intent[]; conflict: string | null } {
  if (state === "broken")
    return { intents: [], conflict: "rules: unexpected symlink layout, fix it by hand" };
  if (reached(state, mode) || state === "none") return { intents: [], conflict: null };
  const pure = toPure(state, replace, from, merged);
  if (pure === null)
    return {
      intents: [],
      conflict:
        "rules: CLAUDE.md and AGENTS.md both exist and differ; re-run with --replace: --from claude keeps CLAUDE.md, --from opencode keeps AGENTS.md",
    };
  let tail: Intent[] = [];
  if (mode === "bridge") tail = [BRIDGE];
  else if (mode === "symlink") tail = [LINK];
  return { intents: [...pure, ...tail], conflict: null };
}

function reached(state: RulesState, mode: RuleMode): boolean {
  return state === mode || (state === "amp" && mode === "symlink");
}
