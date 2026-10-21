import type { Side } from "../core/schema/harmony.ts";
import { dirs, mds } from "./fs-info.ts";
import { exists } from "../io/fs.ts";
import type { Layout } from "./layout.ts";
import type { RulesState } from "../core/harmonize/rules.ts"; // What each side holds on disk, and which one is the source of truth: more
// markers wins, Claude Code on a tie. `--from` overrides the call.
export type Markers = {
  from: Side;
  cc: {
    settings: boolean;
    local: boolean;
    commands: string[];
    agents: string[];
    skills: string[];
    mcp: boolean;
  };
  oc: { config: boolean; commands: string[]; agents: string[] };
};

export async function markers(lay: Layout, state: RulesState): Promise<Markers> {
  const cc = {
    settings: await exists(lay.settings),
    local: await exists(lay.settingsLocal),
    commands: await mds(lay.ccCommands),
    agents: await mds(lay.ccAgents),
    skills: await dirs(lay.skills),
    mcp: await exists(lay.mcpJson),
  };
  const oc = {
    config: await exists(lay.ocConfig),
    commands: await mds(lay.ocCommands),
    agents: await mds(lay.ocAgents),
  };
  const ccScore = score(cc.commands, cc.agents, cc.skills, [
    cc.settings,
    cc.local,
    cc.mcp,
    state !== "pure",
  ]);
  const ocScore = score(oc.commands, oc.agents, [], [oc.config, state !== "claude-only"]);
  return { from: ocScore > ccScore ? "opencode" : "claude", cc, oc };
}

const score = (commands: string[], agents: string[], skills: string[], flags: boolean[]): number =>
  flags.filter(Boolean).length +
  (commands.length > 0 ? 1 : 0) +
  (agents.length > 0 ? 1 : 0) +
  (skills.length > 0 ? 1 : 0);
