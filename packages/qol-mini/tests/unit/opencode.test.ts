import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { cliWithout } from "../../src/opencode/cli-without.ts";
import { cliFor } from "../../src/opencode/cli-settings.ts";
import { opencodeDir } from "../../src/opencode/config-dir.ts";
import type { Chosen } from "../../src/kit/options.ts";

const on: Chosen = { statusline: true, sounds: true, tabs: true, kaizen: true, warn: 1, alert: 2 };
const user = {
  theme: { name: "tokyonight" },
  attention: { notifications: true, volume: 0.4 },
  terminal: { copy: "manual", title: true },
};

test("the config dir follows XDG_CONFIG_HOME as OpenCode does, else ~/.config", () => {
  expect(opencodeDir({ XDG_CONFIG_HOME: "/tmp/xdg" })).toBe("/tmp/xdg/opencode");
  expect(opencodeDir({})).toBe(join(homedir(), ".config", "opencode"));
});

test("sounds on: attention names the kit's wavs, the title is released to OpenCode when off", () => {
  const merged = cliFor(on, "/c", user, "linux");
  const attention = merged["attention"] as Record<string, unknown>;
  expect(attention["sound"]).toBe(true);
  expect(attention["notifications"]).toBe(true);
  expect(attention["volume"]).toBe(0.4);
  expect(attention["sounds"]).toMatchObject({
    permission: "/c/sounds/needs-you.wav",
    question: "/c/sounds/needs-you.wav",
    done: "/c/sounds/done.wav",
    error: "/c/sounds/silent.wav",
    subagent_done: "/c/sounds/silent.wav",
  });
  expect(merged["terminal"]).toStrictEqual({ copy: "manual", title: false });
  const off = cliFor({ ...on, sounds: false, tabs: false }, "/c", merged);
  expect(off["attention"]).toStrictEqual({ notifications: true, volume: 0.4 });
  expect(off["terminal"]).toStrictEqual({ copy: "manual" });
  // No /dev/tty on Windows: no marker, so OpenCode keeps its own title
  expect(cliFor(on, "/c", user, "win32")["terminal"]).toStrictEqual({ copy: "manual" });
});

test("uninstall leaves in cli.json nothing of ours: the title we own goes with it", () => {
  const cleaned = cliWithout(cliFor(on, "/c", user));
  expect(cleaned).toStrictEqual({
    theme: { name: "tokyonight" },
    attention: { notifications: true, volume: 0.4 },
    terminal: { copy: "manual" },
  });
});
