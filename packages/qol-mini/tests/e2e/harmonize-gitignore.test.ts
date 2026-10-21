import { rm } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { expect, test } from "vite-plus/test";
import { harm, repo } from "../helpers/harmony.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  ".gitignore": "AGENTS.md\n.opencode/\n",
  "CLAUDE.md": "# Rules\n",
  ".claude/commands/deploy.md": "---\ndescription: d\n---\nBody\n",
};

test("kept files git ignores are named with their rule, nothing is blocked", async () => {
  const dir = await repo(FILES);
  await rm(join(dir, ".git"), { recursive: true });
  await execa("git", ["init", "-q"], { cwd: dir });
  const dry = await harm(dir, [".", "--dry-run"]);
  expect(dry.code).toBe(0);
  expect(dry.out).toContain("AGENTS.md is ignored by git (.gitignore:1: AGENTS.md)");
  const run = await harm(dir, [".", "-y"]);
  expect(run.code).toBe(0);
  expect(run.out).toContain(
    ".opencode/commands/deploy.md is ignored by git (.gitignore:2: .opencode/)",
  );
  expect(run.out).not.toContain("qol-mini.lock.json is ignored");
  await cleanup(dir);
});
