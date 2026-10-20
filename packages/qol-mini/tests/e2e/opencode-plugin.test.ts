import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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

test("one reminder per compaction event, however many copies see it", async () => {
  const home = await tmpDir();
  const source = JSON.stringify(pathToFileURL(join(SHIPPED, "shared.js")).href);
  const claim = async (id: string): Promise<number> => {
    const { exitCode } = await execa("node", ["--input-type=module"], {
      input: `import { oncePerEvent } from ${source}; process.exit(oncePerEvent(${JSON.stringify(id)}) ? 0 : 1)`,
      env: { ...process.env, CLAUDE_CONFIG_DIR: home },
      reject: false,
    });
    return exitCode ?? 1;
  };
  try {
    expect(await claim("evt_same")).toBe(0);
    expect(await claim("evt_same")).toBe(1);
    expect(await claim("../escape")).toBe(0);
    expect(existsSync(join(home, "state", "remind-..-escape"))).toBe(true);
  } finally {
    await cleanup(home);
  }
});
