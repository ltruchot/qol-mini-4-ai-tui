import { mkdir, utimes } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { hook } from "../helpers/kit.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

const OLD = new Date(Date.now() - 30 * 24 * 3600 * 1000);

test("a sweep that fails never opens the /compact gate", async () => {
  const target = await tmpDir();
  const config = join(target, "config");
  const state = join(config, "state");
  // A directory under a token name: the sweep's unlink throws on it
  await mkdir(join(state, "kaizen-stuck-00000000.done"), { recursive: true });
  await utimes(join(state, "kaizen-stuck-00000000.done"), OLD, OLD);
  const env = { env: { CLAUDE_CONFIG_DIR: config } };
  const manual = JSON.stringify({ trigger: "manual", cwd: target });
  expect((await hook("precompact-kaizen", [], manual, env)).code).toBe(2);
  await hook("precompact-kaizen", ["--release"], "", { ...env, cwd: target });
  expect((await hook("precompact-kaizen", [], manual, env)).code).toBe(0);
  expect((await hook("precompact-kaizen", [], manual, env)).code).toBe(2);
  await cleanup(target);
});
