import { existsSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { kit, openDir } from "../helpers/kit.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

test("a settings.json that does not parse stops uninstall before any file goes", async () => {
  const target = await tmpDir();
  await kit(target, ["install", "--tab-state"]);
  await writeFile(join(target, "settings.json"), "{ not json");
  expect((await kit(target, ["uninstall"])).code).not.toBe(0);
  expect(existsSync(join(target, "hooks/tab-state.mjs"))).toBe(true);
  expect(existsSync(join(openDir(target), "plugins/qol-mini/shared.js"))).toBe(true);
  await writeFile(join(target, "settings.json"), "{}");
  await writeFile(join(openDir(target), "cli.json"), "{ not json");
  expect((await kit(target, ["uninstall"])).code).not.toBe(0);
  expect(existsSync(join(target, "hooks/tab-state.mjs"))).toBe(true);
  await cleanup(target);
});

test("uninstall keeps a replaced sound and an edited skill, and names them", async () => {
  const target = await tmpDir();
  await kit(target, ["install"]);
  await writeFile(join(target, "sounds/done.wav"), "mine");
  await appendFile(join(target, "skills/kaizen/SKILL.md"), "\nMy own step.\n");
  const run = await kit(target, ["uninstall"]);
  expect(run.out).toContain("kept, edited  sounds/done.wav");
  expect(run.out).toContain("kept, edited  skills/kaizen/SKILL.md");
  expect(run.out).toContain("removed       sounds/needs-you.wav");
  expect(existsSync(join(target, "sounds/done.wav"))).toBe(true);
  expect(existsSync(join(target, "skills/kaizen/SKILL.md"))).toBe(true);
  expect(existsSync(join(target, "hooks"))).toBe(false);
  await cleanup(target);
});
