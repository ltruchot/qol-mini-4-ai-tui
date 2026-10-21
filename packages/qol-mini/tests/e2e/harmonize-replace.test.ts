import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { harm, put, repo } from "../helpers/harmony.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  "CLAUDE.md": "# Rules\n",
  ".claude/settings.json": JSON.stringify({ permissions: { allow: ["Bash(git:*)"] } }),
};

test("a conflicting layout writes nothing and says what --replace would do", async () => {
  const dir = await repo(FILES);
  await put(dir, { "AGENTS.md": "# Other\n" });
  const run = await harm(dir, ["."]);
  expect(run.code).toBe(1);
  expect(run.out).toContain("--replace");
  expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe("# Rules\n");
  await cleanup(dir);
});

test("--replace --from claude keeps CLAUDE.md content under AGENTS.md", async () => {
  const dir = await repo(FILES);
  await put(dir, { "AGENTS.md": "# Other\n" });
  const run = await harm(dir, [".", "--replace", "--from", "claude"]);
  expect(run.code).toBe(0);
  expect(await readFile(join(dir, "AGENTS.md"), "utf8")).toBe("# Rules\n");
  expect(await readFile(join(dir, "opencode.json"), "utf8")).toContain("git *");
  await cleanup(dir);
});
