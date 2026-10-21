import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { exists } from "../../src/io/fs.ts";
import { harm, put, repo } from "../helpers/harmony.ts";
import { readLockFile } from "../helpers/json.ts";
import { cleanup } from "../helpers/tmp.ts";

const perm = (allow: string[]): string => JSON.stringify({ permissions: { allow } });
const FILES = { "CLAUDE.md": "# Rules\n", ".claude/settings.json": perm(["Bash(git:*)"]) };

test("a re-run keeps the earlier rule move and the created flag", async () => {
  const dir = await repo(FILES);
  expect((await harm(dir, ["."])).code).toBe(0);
  await put(dir, { ".claude/settings.json": perm(["Bash(git:*)", "Bash(ls:*)"]) });
  expect((await harm(dir, ["."])).code).toBe(0);
  const lock = await readLockFile(join(dir, ".claude/qol-mini.lock.json"));
  expect(lock.harmonize?.ops).toStrictEqual([{ op: "mv", path: "CLAUDE.md", to: "AGENTS.md" }]);
  expect(lock.harmonize?.artifacts["opencode.json"]?.created).toBe(true);
  expect(lock.harmonize?.artifacts["opencode.json"]?.slot).toBeUndefined();
  expect((await harm(dir, ["undo", "-y"])).code).toBe(0);
  expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe("# Rules\n");
  expect(await exists(join(dir, "AGENTS.md"))).toBe(false);
  expect(await exists(join(dir, "opencode.json"))).toBe(false);
  await cleanup(dir);
});

test("a re-run keeps the backup of the user's own file", async () => {
  const mine = '{"theme":"dark"}\n';
  const dir = await repo({ ...FILES, "opencode.json": mine });
  expect((await harm(dir, [".", "--replace"])).code).toBe(0);
  await put(dir, { ".claude/settings.json": perm(["Bash(ls:*)"]) });
  expect((await harm(dir, ["."])).code).toBe(0);
  const art = (await readLockFile(join(dir, ".claude/qol-mini.lock.json"))).harmonize?.artifacts[
    "opencode.json"
  ];
  expect(art?.created).toBe(false);
  expect((await harm(dir, ["undo", "-y"])).code).toBe(0);
  expect(await readFile(join(dir, "opencode.json"), "utf8")).toBe(mine);
  await cleanup(dir);
});
