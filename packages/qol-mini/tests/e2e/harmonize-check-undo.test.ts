import { readFile, writeFile } from "node:fs/promises";
import { exists } from "../../src/io/fs.ts";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { harm, repo } from "../helpers/harmony.ts";
import { readLockFile } from "../helpers/json.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  "CLAUDE.md": "# Rules\n",
  ".claude/settings.json": JSON.stringify({ permissions: { allow: ["Bash(git:*)"] } }),
};

test("check exits 0 in sync, 1 on a source change, 2 on an edited file", async () => {
  const dir = await repo(FILES);
  expect((await harm(dir, ["."])).code).toBe(0);
  expect((await harm(dir, ["check"])).code).toBe(0);
  await writeFile(
    join(dir, ".claude/settings.json"),
    JSON.stringify({ permissions: { allow: [] } }),
  );
  const changed = await harm(dir, ["check"]);
  expect(changed.code).toBe(1);
  await writeFile(join(dir, "opencode.json"), "{}\n");
  expect((await harm(dir, ["check"])).code).toBe(2);
  await cleanup(dir);
});

test("undo restores the repo and keeps the skills lock usable", async () => {
  const dir = await repo({ ...FILES, ".claude/qol-mini.lock.json": '{"version":1,"skills":{}}' });
  await harm(dir, ["."]);
  expect(await exists(join(dir, "AGENTS.md"))).toBe(true);
  const undo = await harm(dir, ["undo", "-y"]);
  expect(undo.code).toBe(0);
  expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe("# Rules\n");
  expect(await exists(join(dir, "AGENTS.md"))).toBe(false);
  expect(await exists(join(dir, "opencode.json"))).toBe(false);
  const lock = await readLockFile(join(dir, ".claude/qol-mini.lock.json"));
  expect(lock.harmonize).toBeUndefined();
  expect(lock.version).toBe(1);
  expect((await harm(dir, ["check"])).code).toBe(1);
  await cleanup(dir);
});
