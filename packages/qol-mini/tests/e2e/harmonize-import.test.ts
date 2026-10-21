import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { exists } from "../../src/io/fs.ts";
import { harm, repo } from "../helpers/harmony.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  "CLAUDE.md": "# Project\n\n- rule one\n",
  "AGENTS.md": "**Priority**: never touch /x.\n\nFollow @CLAUDE.md for the project guidelines.\n",
};

test("aGENTS.md importing CLAUDE.md merges with no --replace; undo restores both", async () => {
  const dir = await repo(FILES);
  const run = await harm(dir, [".", "-y"]);
  expect(run.code).toBe(0);
  expect(run.out).toContain("write AGENTS.md (merged)");
  expect(run.out).toContain(
    '"Follow @CLAUDE.md for the project guidelines." replaced by CLAUDE.md',
  );
  expect(await readFile(join(dir, "AGENTS.md"), "utf8")).toBe(
    "**Priority**: never touch /x.\n\n# Project\n\n- rule one\n",
  );
  expect(await exists(join(dir, "CLAUDE.md"))).toBe(false);
  expect((await harm(dir, ["check", "."])).code).toBe(0);
  expect((await harm(dir, ["undo", ".", "-y"])).code).toBe(0);
  expect(await readFile(join(dir, "CLAUDE.md"), "utf8")).toBe(FILES["CLAUDE.md"]);
  expect(await readFile(join(dir, "AGENTS.md"), "utf8")).toBe(FILES["AGENTS.md"]);
  await cleanup(dir);
});
