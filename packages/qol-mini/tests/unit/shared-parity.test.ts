import { existsSync, mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, vi } from "vite-plus/test";
import { stateDir, tokenFor } from "../../src/kit/hooks/kaizen-token.ts";
import { hookOutput } from "../../src/kit/hooks/marker.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

type Shared = {
  tokenFor: (cwd: string) => string;
  titleSequence: (state: "working" | "blocked" | "idle", cwd: string) => string;
  compactionPasses: (cwd: string) => boolean;
};
const SHARED = pathToFileURL(join(import.meta.dirname, "../../opencode/shared.js")).href;
const shared = async (): Promise<Shared> => (await import(SHARED)) as Shared;

test("the plugin and the hook agree on the token, the title and the sweep", async () => {
  const config = await tmpDir();
  vi.stubEnv("CLAUDE_CONFIG_DIR", config);
  vi.stubEnv("CC_TAB_IDLE", "z\u0007z");
  const js = await shared();
  for (const dir of [config, "/", join(config, "no such dir"), "/tmp/a b/é"])
    expect(js.tokenFor(dir)).toBe(tokenFor(dir));
  for (const dir of ["/", "/tmp/de\u0007mo", config])
    expect(js.titleSequence("idle", dir)).toBe(hookOutput("idle", dir).terminalSequence);
  expect(js.titleSequence("idle", "/")).toBe("\u001B]0;zz /\u001B\\");
  mkdirSync(stateDir(), { recursive: true });
  const stale = join(stateDir(), "kaizen-old-00000000.done");
  writeFileSync(stale, "");
  const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  utimesSync(stale, old, old);
  expect(js.compactionPasses(config)).toBe(false);
  expect(existsSync(stale)).toBe(false);
  vi.unstubAllEnvs();
  await cleanup(config);
});
