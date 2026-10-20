import { existsSync, rmdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { cleanConfig } from "../kit/clean-config.ts";
import { row } from "../kit/report.ts";
import { cliWithout } from "./cli-without.ts";
import { opencodeDir } from "./config-dir.ts";
import { DIRS, KAIZEN_COMMAND, PLUGIN_FILES } from "./files.ts";

const FILES = [...PLUGIN_FILES, KAIZEN_COMMAND];

// Remove what install added to the OpenCode config dir
export function uninstallOpen(): boolean {
  const target = opencodeDir();
  const removed = FILES.filter((r) => existsSync(join(target, r)));
  for (const relative of removed) {
    unlinkSync(join(target, relative));
    row("removed", relative);
  }
  for (const dir of DIRS) {
    try {
      rmdirSync(join(target, dir));
    } catch {
      // not empty, or not there
    }
  }
  const cleaned = cleanConfig(target, "cli.json", cliWithout);
  return removed.length > 0 || cleaned;
}
