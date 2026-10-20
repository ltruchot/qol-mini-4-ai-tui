import { put } from "../kit/settings.ts";
import type { Settings } from "../kit/state.ts";
import { block } from "./cli-settings.ts";

// What uninstall leaves in cli.json: nothing of ours. `terminal.title` false
// is ours; any other value was written by the user and stays.
export function cliWithout(current: Settings): Settings {
  const data = structuredClone(current);
  const attention = block(data, "attention");
  delete attention["sound"];
  delete attention["sounds"];
  put(data, "attention", attention);
  const terminal = block(data, "terminal");
  if (terminal["title"] === false) delete terminal["title"];
  put(data, "terminal", terminal);
  return data;
}
