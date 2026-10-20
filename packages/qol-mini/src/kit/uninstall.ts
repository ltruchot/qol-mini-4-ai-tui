import { existsSync, rmdirSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { configDir } from "../io/config-dir.ts";
import { print } from "../io/ui.ts";
import { cleanConfig } from "./clean-config.ts";
import { uninstallOpen } from "../opencode/uninstall.ts";
import { BUNDLES, KAIZEN_SKILL, SOUNDS, SUPERSEDED } from "./files.ts";
import { row } from "./report.ts";
import { settingsWithout } from "./settings-without.ts";

const FILES = [...Object.keys(BUNDLES), KAIZEN_SKILL, ...SOUNDS.map((n) => `sounds/${n}`)];
// Emptied dirs go; one holding something of the user's stays
const DIRS = ["skills/kaizen", "skills", "hooks", "sounds"];

function removeFiles(target: string): string[] {
  const removed = [...FILES, ...SUPERSEDED].filter((r) => existsSync(join(target, r)));
  for (const relative of removed) unlinkSync(join(target, relative));
  if (existsSync(join(target, "state"))) {
    rmSync(join(target, "state"), { recursive: true, force: true });
    removed.push("state/");
  }
  for (const dir of DIRS)
    try {
      rmdirSync(join(target, dir));
    } catch {
      // not empty, or not there
    }
  return removed;
}

// Remove what install added, from both targets
export function runUninstall(): number {
  const target = configDir();
  const removed = removeFiles(target);
  for (const relative of removed) row("removed", relative);
  const cleaned = cleanConfig(target, "settings.json", settingsWithout);
  const open = uninstallOpen();
  const touched = removed.length > 0 || cleaned || open;
  print([
    touched ? "Done. Restart Claude Code and OpenCode." : "Nothing of ours left. Nothing changed.",
  ]);
  return 0;
}
