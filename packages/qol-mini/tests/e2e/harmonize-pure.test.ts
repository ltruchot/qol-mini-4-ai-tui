import { exists } from "../../src/io/fs.ts";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { harm, repo } from "../helpers/harmony.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = { "CLAUDE.md": "# Rules\n", ".claude/settings.json": "{}" };

test("dry run writes nothing", async () => {
  const dir = await repo(FILES);
  const run = await harm(dir, [".", "--dry-run"]);
  expect(run.code).toBe(0);
  expect(run.out).toContain("mv CLAUDE.md -> AGENTS.md");
  expect(await exists(join(dir, "AGENTS.md"))).toBe(false);
  expect(await exists(join(dir, "opencode.json"))).toBe(false);
  await cleanup(dir);
});

test("a pure repo stays put, a repo with no rules file says so", async () => {
  const pure = await repo({ "AGENTS.md": "# Rules\n" });
  const run = await harm(pure, ["."]);
  expect(run.code).toBe(0);
  expect(run.out).toContain("nothing to do");
  await cleanup(pure);
  const empty = await repo({});
  const note = await harm(empty, ["."]);
  expect(note.code).toBe(0);
  expect(note.out).toContain("rules: no rules file, nothing renamed");
  await cleanup(empty);
});

test("check on a repo never harmonized says so", async () => {
  const dir = await repo({ "CLAUDE.md": "# R\n" });
  const run = await harm(dir, ["check"]);
  expect(run.code).toBe(1);
  expect(run.out).toContain("not harmonized");
  await cleanup(dir);
});
