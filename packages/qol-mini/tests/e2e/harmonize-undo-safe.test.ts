import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { exists } from "../../src/io/fs.ts";
import { harm, put, repo } from "../helpers/harmony.ts";
import type { LockFile } from "../../src/core/schema/lock.ts";
import { readLockFile } from "../helpers/json.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  "CLAUDE.md": "# Rules\n",
  ".claude/settings.json": JSON.stringify({ permissions: { allow: ["Bash(git:*)"] } }),
};
const lockOf = (dir: string): Promise<LockFile> =>
  readLockFile(join(dir, ".claude/qol-mini.lock.json"));

test("undo --dry-run lists the steps and writes nothing", async () => {
  const dir = await repo(FILES);
  await harm(dir, ["."]);
  const dry = await harm(dir, ["undo", "--dry-run"]);
  expect(dry.code).toBe(0);
  expect(dry.out).toContain("mv AGENTS.md -> CLAUDE.md");
  expect(dry.out).toContain("rm opencode.json");
  expect(await exists(join(dir, "AGENTS.md"))).toBe(true);
  expect(await exists(join(dir, "CLAUDE.md"))).toBe(false);
  expect(await exists(join(dir, "opencode.json"))).toBe(true);
  expect((await lockOf(dir)).harmonize).toBeDefined();
  await cleanup(dir);
});

test("undo keeps a generated file edited since the run; --replace takes it", async () => {
  const dir = await repo(FILES);
  await harm(dir, ["."]);
  await put(dir, { "opencode.json": '{"mine":true}\n' });
  const undo = await harm(dir, ["undo", "-y"]);
  expect(undo.code).toBe(0);
  expect(undo.out).toContain("opencode.json: edited since the run, left in place");
  expect(await readFile(join(dir, "opencode.json"), "utf8")).toBe('{"mine":true}\n');
  expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe("# Rules\n");
  const kept = (await lockOf(dir)).harmonize;
  expect(Object.keys(kept?.artifacts ?? {})).toStrictEqual(["opencode.json"]);
  expect(kept?.ops).toStrictEqual([]);
  expect((await harm(dir, ["undo", "-y", "--replace"])).code).toBe(0);
  expect(await exists(join(dir, "opencode.json"))).toBe(false);
  expect((await lockOf(dir)).harmonize).toBeUndefined();
  await cleanup(dir);
});
