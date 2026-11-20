import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { expect, test } from "vite-plus/test";
import { hook } from "../helpers/kit.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

const CLI = join(import.meta.dirname, "../../src/cli.ts");

// The project copy of kaizen releases through the CLI, the hook honors it
test("qol-mini kaizen release writes the token the PreCompact hook honors", async () => {
  const target = await tmpDir();
  const here = join(target, "proj");
  await mkdir(here);
  const env = { CLAUDE_CONFIG_DIR: join(target, "config") };
  const manual = JSON.stringify({ trigger: "manual", cwd: here });
  const gate = (): ReturnType<typeof hook> => hook("precompact-kaizen", [], manual, { env });
  expect((await gate()).code).toBe(2);
  const run = await execa("node", [CLI, "kaizen", "release"], { cwd: here, env, reject: false });
  expect(run.exitCode).toBe(0);
  expect(run.stdout).toContain("Kaizen recorded");
  const token = await hook("precompact-kaizen", ["--token"], "", { env, cwd: here });
  expect(run.stdout).toContain(token.out.trim());
  expect((await gate()).code).toBe(0);
  expect((await gate()).code).toBe(2);
  await cleanup(target);
});
