import { existsSync } from "node:fs";
import { join } from "node:path";
import { readConfig } from "../io/config-file.ts";
import type { Chosen } from "../kit/options.ts";
import { diff, sameSettings, type Diff } from "../kit/diff.ts";
import type { Settings } from "../kit/state.ts";
import { cliFor } from "./cli-settings.ts";
import { opencodeDir } from "./config-dir.ts";
import { KAIZEN_COMMAND } from "./files.ts";
import { openPayloads } from "./payloads.ts";

export type OpenPlan = {
  target: string;
  d: Diff;
  wanted: Map<string, Buffer>;
  // A delivered file no longer wanted: a slash command stays active on disk,
  // unlike an unwired hook, so it goes
  stale: string[];
  cli: { before: Settings; after: Settings; changed: boolean };
  // The plugin files cannot reload hot: the service must be restarted
  plugin: boolean;
};

const readCli = (target: string): Settings => readConfig(join(target, "cli.json"));

// The OpenCode side of an install: delivered files plus the cli.json merge
export async function planOpen(chosen: Chosen, claude: string): Promise<OpenPlan> {
  const target = opencodeDir();
  const wanted = await openPayloads(chosen);
  const before = readCli(target);
  const after = cliFor(chosen, claude, before);
  const d = diff(target, wanted);
  const files = [...d.create, ...d.clash];
  return {
    target,
    d,
    wanted,
    stale: (chosen.kaizen ? [] : [KAIZEN_COMMAND]).filter((r) => existsSync(join(target, r))),
    cli: { before, after, changed: !sameSettings(before, after) },
    plugin: files.some((r) => r.startsWith("plugins/")),
  };
}

export function openIdle(p: OpenPlan): boolean {
  return (
    p.d.create.length === 0 && p.d.clash.length === 0 && p.stale.length === 0 && !p.cli.changed
  );
}
