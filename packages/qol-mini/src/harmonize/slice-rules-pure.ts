import type { Side } from "../core/schema/harmony.ts";
import type { RulesState } from "../core/harmonize/rules.ts";
import type { Merged } from "../core/harmonize/rules-merge.ts";
import type { Intent } from "./plan-types.ts";

const TO_AGENTS: Intent = { op: "mv", path: "CLAUDE.md", to: "AGENTS.md" };
const OFF_CLAUDE: Intent = { op: "unlink", path: "CLAUDE.md" };
const OFF_AGENTS: Intent = { op: "unlink", path: "AGENTS.md" };

// The moves that leave AGENTS.md alone, null when the layout needs --replace
export function toPure(
  state: RulesState,
  replace: boolean,
  from: Side,
  merged: Merged | null,
): Intent[] | null {
  if (state === "claude-only") return [TO_AGENTS];
  if (state === "bridge" || state === "amp") return [OFF_CLAUDE];
  if (state === "legacy") return [OFF_AGENTS, TO_AGENTS];
  if (state === "diverged") {
    // One file importing the other is one set of rules: merged, no conflict
    if (merged !== null && !replace)
      return [{ op: "write", path: "AGENTS.md", content: merged.text }, OFF_CLAUDE];
    if (!replace) return null;
    return from === "opencode" ? [OFF_CLAUDE] : [OFF_AGENTS, TO_AGENTS];
  }
  if (state === "broken") return null;
  return []; // pure, none
}
