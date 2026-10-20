import { join } from "node:path";
import { readConfig } from "../io/config-file.ts";
import { configDir } from "../io/config-dir.ts";
import { stdinIsConsole } from "../io/console.ts";
import { print } from "../io/ui.ts";
import { applyOpen } from "../opencode/apply.ts";
import { openIdle, planOpen } from "../opencode/plan.ts";
import { apply } from "./apply.ts";
import { hints } from "./hints.ts";
import { interview } from "./interview.ts";
import { parse } from "./parse.ts";
import { payloads } from "./payloads.ts";
import { idle, plan, sameSettings } from "./plan.ts";
import { printClash, printOptout } from "./report.ts";
import { settingsFor } from "./settings.ts";
import { installedState, type Settings } from "./state.ts";

// With no option and a real console, ask. With any option, or a stdin that
// is not a console, ask nothing: a prompt that blocks a script is a bug.
export async function runInstall(argv: string[]): Promise<number> {
  const decisive = argv.filter((arg) => arg !== "--replace");
  const target = configDir();
  const installed = installedState(target);
  const asking = decisive.length === 0 && stdinIsConsole();
  const chosen = asking ? await interview(installed) : parse(decisive, installed);
  const before = readConfig(join(target, "settings.json")) as Settings;
  const wanted = await payloads(chosen, target, process.execPath);
  const merged = settingsFor(chosen, target, process.execPath, before);
  const p = plan(chosen, target, wanted, !sameSettings(merged, before));
  const o = await planOpen(chosen, target);
  // A clash in either target refuses the run: both are named, nothing is written
  const blocks = [
    ...(p.clash.length > 0 ? [{ target, files: p.clash }] : []),
    ...(o.d.clash.length > 0 ? [{ target: o.target, files: o.d.clash }] : []),
  ];
  if (blocks.length > 0 && !argv.includes("--replace")) {
    printClash(blocks);
    return 1;
  }
  if (idle(p) && openIdle(o)) {
    print([`Already installed in ${target} and ${o.target}. Nothing changed.`]);
    printOptout();
    return 0;
  }
  const { newSkillsDir } = apply(p, target, wanted, merged);
  const open = applyOpen(o);
  hints(chosen, before, merged, newSkillsDir, p.settings, p.stale.length > 0, open);
  return 0;
}
