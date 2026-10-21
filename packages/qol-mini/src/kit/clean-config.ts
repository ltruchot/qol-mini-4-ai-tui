import { join } from "node:path";
import { readConfig } from "../io/config-file.ts";
import { sameSettings } from "./diff.ts";
import { row } from "./report.ts";
import { saveNamed } from "./save-settings.ts";
import type { Settings } from "./state.ts";

// Remove this kit's keys from a config file, written only when the cleanup
// changes it. Shared by both targets' uninstall.
export function cleanConfig(
  target: string,
  name: string,
  without: (data: Settings) => Settings,
): boolean {
  const before = readConfig(join(target, name));
  const after = without(before);
  if (sameSettings(before, after)) return false;
  saveNamed(target, name, after);
  row("cleaned", name);
  return true;
}
