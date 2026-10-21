import { existsSync, rmdirSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { configDir } from "../io/config-dir.ts";
import { print } from "../io/ui.ts";
import { cleanConfig } from "./clean-config.ts";
import { uninstallOpen } from "../opencode/uninstall.ts";
import { BUNDLES, SUPERSEDED } from "./files.ts";
import { row } from "./report.ts";
import { settingsWithout } from "./settings-without.ts";
import { ownedEditable } from "./uninstall-owned.ts";

// Emptied dirs go; one holding something of the user's stays
const DIRS = ["skills/kaizen", "skills", "hooks", "sounds"];

async function removeFiles(target: string): Promise<string[]> {
  const present = (r: string): boolean => existsSync(join(target, r));
  const owned = await ownedEditable(target);
  const removed = [...Object.keys(BUNDLES), ...SUPERSEDED, ...owned].filter(present);
  for (const relative of removed) unlinkSync(join(target, relative));
  if (present("state")) {
    rmSync(join(target, "state"), { recursive: true, force: true });
    removed.push("state/");
  }
  for (const dir of DIRS) {
    try {
      rmdirSync(join(target, dir));
    } catch {
      // not empty, or not there
    }
  }
  return removed;
}

// Remove what install added, from both targets. Configs first: one that fails
// to parse stops the run before any hook it wires loses its script.
export async function runUninstall(): Promise<number> {
  const target = configDir();
  const cleaned = cleanConfig(target, "settings.json", settingsWithout);
  const open = uninstallOpen();
  const removed = await removeFiles(target);
  for (const relative of removed) row("removed", relative);
  const touched = removed.length > 0 || cleaned || open;
  print([
    touched ? "Done. Restart Claude Code and OpenCode." : "Nothing of ours left. Nothing changed.",
  ]);
  return 0;
}
