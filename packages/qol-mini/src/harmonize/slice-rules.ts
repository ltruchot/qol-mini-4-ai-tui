import type { RuleMode, Side } from "../core/schema/harmony.ts";
import type { RulesState } from "../core/harmonize/rules.ts";
import type { Intent } from "./plan-types.ts";

const BRIDGE: Intent = { op: "write", path: "CLAUDE.md" };
const LINK: Intent = { op: "symlink", path: "CLAUDE.md", to: "AGENTS.md" };
const TO_AGENTS: Intent = { op: "mv", path: "CLAUDE.md", to: "AGENTS.md" };
const OFF_CLAUDE: Intent = { op: "unlink", path: "CLAUDE.md" };
const OFF_AGENTS: Intent = { op: "unlink", path: "AGENTS.md" };

// Rule moves to reach `mode` from `state`. AGENTS.md is the canonical file in
// every mode; the modes differ in what CLAUDE.md becomes after the move.
export function planRules(
  state: RulesState,
  mode: RuleMode,
  replace: boolean,
  from: Side,
): { intents: Intent[]; conflict: string | null } {
  if (state === "broken")
    return { intents: [], conflict: "rules: unexpected symlink layout, fix it by hand" };
  if (reached(state, mode) || state === "none") return { intents: [], conflict: null };
  const pure = toPure(state, replace, from);
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

function toPure(state: RulesState, replace: boolean, from: Side): Intent[] | null {
  if (state === "claude-only") return [TO_AGENTS];
  if (state === "bridge" || state === "amp") return [OFF_CLAUDE];
  if (state === "legacy") return [OFF_AGENTS, TO_AGENTS];
  if (state === "diverged") {
    if (!replace) return null;
    return from === "opencode" ? [OFF_CLAUDE] : [OFF_AGENTS, TO_AGENTS];
  }
  if (state === "broken") return null;
  return []; // pure, none
}
