import { existsSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { expect, test } from "vite-plus/test";
import { kit, openDir, readJson } from "../helpers/kit.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

const SHIPPED = join(import.meta.dirname, "../../opencode");

test("--no-sounds unwinds the attention block, --no-kaizen takes the command", async () => {
  const target = await tmpDir();
  const dir = openDir(target);
  await kit(target, ["install", "--tab-state"]);
  const updated = await kit(target, ["install", "--no-sounds", "--no-kaizen"]);
  expect(updated.out).toContain("updated       cli.json");
  expect(updated.out).toContain("removed       commands/kaizen.md");
  expect(await readJson(dir, "cli.json")).not.toHaveProperty("attention");
  expect(existsSync(join(dir, "commands/kaizen.md"))).toBe(false);
  expect((await readJson(dir, "cli.json"))["terminal"]).toStrictEqual({ title: false });
  await cleanup(target);
});

test("the shipped plugin parses: node --check on every face", async () => {
  for (const file of ["index.js", "tui.js", "shared.js"]) {
    const run = await execa("node", ["--check", join(SHIPPED, file)]);
    expect(run.exitCode).toBe(0);
  }
});
