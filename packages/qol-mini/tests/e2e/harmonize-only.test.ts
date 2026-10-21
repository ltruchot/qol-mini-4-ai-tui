import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { exists } from "../../src/io/fs.ts";
import { harm, repo } from "../helpers/harmony.ts";
import { readLockFile } from "../helpers/json.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  "CLAUDE.md": "# Rules\n",
  ".claude/settings.json": JSON.stringify({ permissions: { allow: ["Bash(git:*)"] } }),
  ".claude/commands/deploy.md": "---\ndescription: d\n---\nBody\n",
};

test("--only rules moves the rules alone; a full run completes the rest", async () => {
  const dir = await repo(FILES);
  expect((await harm(dir, [".", "--only", "rules"])).code).toBe(0);
  expect(await exists(join(dir, "AGENTS.md"))).toBe(true);
  expect(await exists(join(dir, "opencode.json"))).toBe(false);
  const lock = await readLockFile(join(dir, ".claude/qol-mini.lock.json"));
  expect(lock.harmonize?.artifacts).toStrictEqual({});
  expect(lock.harmonize?.ops).toHaveLength(1);
  expect((await harm(dir, ["."])).code).toBe(0);
  expect(await exists(join(dir, "opencode.json"))).toBe(true);
  expect((await harm(dir, ["check"])).code).toBe(0);
  expect((await harm(dir, ["undo", "-y"])).code).toBe(0);
  expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe("# Rules\n");
  expect(await exists(join(dir, "opencode.json"))).toBe(false);
  await cleanup(dir);
});

test("--only commands writes the commands alone, --only perm names the shared file", async () => {
  const dir = await repo(FILES);
  expect((await harm(dir, [".", "--only", "commands"])).code).toBe(0);
  expect(await exists(join(dir, "CLAUDE.md"))).toBe(true);
  expect(await exists(join(dir, "opencode.json"))).toBe(false);
  const lock = await readLockFile(join(dir, ".claude/qol-mini.lock.json"));
  expect(Object.values(lock.harmonize?.artifacts ?? {}).map((a) => a.kind)).toStrictEqual([
    "command",
  ]);
  const perm = await harm(dir, [".", "--only", "perm"]);
  expect(perm.out).toContain("share opencode.json");
  expect(await exists(join(dir, "opencode.json"))).toBe(true);
  await cleanup(dir);
});
