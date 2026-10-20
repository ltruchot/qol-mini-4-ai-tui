import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { kit, openDir, readJson } from "../helpers/kit.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

test("uninstall removes the opencode files, empties the dirs, cleans cli.json", async () => {
  const target = await tmpDir();
  const dir = openDir(target);
  await kit(target, ["install", "--tab-state"]);
  const out = await kit(target, ["uninstall"]);
  expect(out.out).toContain("removed       plugins/qol-mini/tui.js");
  expect(out.out).toContain("removed       commands/kaizen.md");
  expect(out.out).toContain("cleaned       cli.json");
  expect(out.out).toContain("Restart Claude Code and OpenCode");
  expect(existsSync(join(dir, "plugins"))).toBe(false);
  expect(existsSync(join(dir, "commands"))).toBe(false);
  expect(await readJson(dir, "cli.json")).toStrictEqual({});

  const again = await kit(target, ["uninstall"]);
  expect(again.out).toContain("Nothing of ours left");
  expect(again.out).toContain("Nothing changed");
  await cleanup(target);
});
