import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { harm, put, repo } from "../helpers/harmony.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  "CLAUDE.md": "# Rules\n",
  ".claude/settings.json": JSON.stringify({ permissions: { allow: ["Bash(git:*)"] } }),
};

test("an edited generated file is named, not overwritten; --replace takes it", async () => {
  const dir = await repo(FILES);
  await harm(dir, ["."]);
  await put(dir, { "opencode.json": JSON.stringify({ mine: true }) });
  const run = await harm(dir, ["."]);
  expect(run.code).toBe(0);
  expect(run.out).toContain("edited since the last run");
  const replace = await harm(dir, [".", "--replace"]);
  expect(replace.code).toBe(0);
  const after = JSON.parse(await readFile(join(dir, "opencode.json"), "utf8")) as Record<
    string,
    unknown
  >;
  expect(after["mine"]).toBe(true);
  expect(after["permissions"]).toContainEqual({
    action: "shell",
    resource: "git *",
    effect: "allow",
  });
  await cleanup(dir);
});
