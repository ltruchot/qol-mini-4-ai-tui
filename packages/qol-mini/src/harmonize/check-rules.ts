import type { RuleMode } from "../core/schema/harmony.ts";
import type { RulesState } from "../core/harmonize/rules.ts";

// The layout a rules mode leaves behind: `pure` leaves AGENTS.md alone,
// `bridge` adds a CLAUDE.md import, `symlink` a CLAUDE.md link
const OK_STATE: Record<RuleMode, RulesState> = { pure: "pure", bridge: "bridge", symlink: "amp" };

export function rulesStatus(state: RulesState, mode: RuleMode): "ok" | "drift" {
  return state === OK_STATE[mode] ? "ok" : "drift";
}
