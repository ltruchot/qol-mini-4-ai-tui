import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isBridge, rulesState, type RulesState } from "../core/harmonize/rules.ts";
import { exists } from "../io/fs.ts";
import { ruleGotchas } from "./gotcha.ts";
import { hookEvents, kind, target } from "./fs-info.ts";
import type { Layout } from "./layout.ts";
import { markers, type Markers } from "./markers.ts";

export type Detect = {
  state: RulesState;
  markers: Markers;
  cursorrules: boolean;
  gotchas: string[];
  hooks: string[];
};

// Everything a plan needs to know about the repo before reading any content
export async function detect(lay: Layout, root: string): Promise<Detect> {
  const claude = join(root, "CLAUDE.md");
  const agents = join(root, "AGENTS.md");
  const claudeKind = await kind(claude);
  const state = rulesState({
    claude: claudeKind,
    claudeTarget: await target(claude),
    bridge: claudeKind === "file" && isBridge(await readFile(claude, "utf8")),
    agents: await kind(agents),
    agentsTarget: await target(agents),
  });
  return {
    state,
    markers: await markers(lay, state),
    cursorrules: await exists(`${root}/.cursorrules`),
    gotchas: await ruleGotchas(root),
    hooks: [
      ...(await hookEvents(lay.settings)),
      ...(await hookEvents(lay.settingsLocal)),
    ].toSorted(),
  };
}
