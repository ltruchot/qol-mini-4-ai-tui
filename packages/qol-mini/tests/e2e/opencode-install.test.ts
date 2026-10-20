import { appendFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { kit, openDir, readJson } from "../helpers/kit.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

test("the opencode target: created, idempotent, refused when edited, --replace rewrites", async () => {
  const target = await tmpDir();
  const dir = openDir(target);
  const first = await kit(target, ["install", "--tab-state"]);
  expect(first.out).toContain(`Installing into ${dir}`);
  expect(first.out).toContain("created       plugins/qol-mini/index.js");
  expect(first.out).toContain("created       commands/kaizen.md");
  expect(first.out).toContain("updated       cli.json");
  expect(first.out).toContain("opencode service restart");
  const cli = await readJson(dir, "cli.json");
  expect(cli["terminal"]).toStrictEqual({ title: false });
  expect(await readdir(join(dir, "plugins/qol-mini"))).toHaveLength(4);

  const again = await kit(target, ["install", "--tab-state"]);
  expect(again.out).toContain("Nothing changed");
  await appendFile(join(dir, "plugins/qol-mini/tui.js"), "// edited by hand\n");
  const refused = await kit(target, ["install", "--tab-state"]);
  expect(refused.code).toBe(1);
  expect(refused.out).toContain("tui.js");
  expect(refused.out).toContain("Nothing was written");

  const replaced = await kit(target, ["install", "--replace"]);
  expect(replaced.out).toContain("replaced      plugins/qol-mini/tui.js");
  expect((await readJson(dir, "cli.json"))["terminal"]).toStrictEqual({ title: false });
  await cleanup(target);
});
