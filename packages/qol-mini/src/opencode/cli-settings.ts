import { join } from "node:path";
import type { Chosen } from "../kit/options.ts";
import { put } from "../kit/settings.ts";
import type { Settings } from "../kit/state.ts";

export type Block = Record<string, unknown>;

export const block = (data: Settings, key: string): Block => ({
  ...(data[key] as Block | undefined),
});

// The sounds the kit owns, as absolute paths into the Claude Code config dir: one
// sounds directory serves both agents. OpenCode's own attention events the kit
// is silent on are mapped to silent.wav, its built-in sound would play them.
function sounds(claude: string): Record<string, string> {
  const file = (name: string): string => join(claude, "sounds", name);
  return {
    default: file("silent.wav"),
    question: file("needs-you.wav"),
    permission: file("needs-you.wav"),
    error: file("silent.wav"),
    done: file("done.wav"),
    subagent_done: file("silent.wav"),
  };
}

// The cli.json this install wants, merged onto what is already there. Only the
// keys the kit manages are touched: a user's theme, keybinds and notifications
// survive. `terminal.title` is ours only while the marker paints the title:
// never on Windows, which has no /dev/tty for the plugin to write it to.
export function cliFor(
  chosen: Chosen,
  claude: string,
  current: Settings,
  platform: NodeJS.Platform = process.platform,
): Settings {
  const data = structuredClone(current);
  const attention = block(data, "attention");
  if (chosen.sounds) Object.assign(attention, { sound: true, sounds: sounds(claude) });
  else {
    delete attention["sound"];
    delete attention["sounds"];
  }
  put(data, "attention", attention);
  const terminal = block(data, "terminal");
  if (chosen.tabs && platform !== "win32") terminal["title"] = false;
  else delete terminal["title"];
  put(data, "terminal", terminal);
  return data;
}
