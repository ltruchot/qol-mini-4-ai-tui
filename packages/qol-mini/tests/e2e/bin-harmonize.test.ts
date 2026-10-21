import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { expect, test } from "vite-plus/test";
import { split } from "../../src/core/harmonize/fm.ts";
import { repo } from "../helpers/harmony.ts";
import { expectAgent } from "../helpers/opencode.ts";
import { cleanup } from "../helpers/tmp.ts";

// The published bundle, not the sources: a dependency that bundles badly
// only fails here
const BIN = join(import.meta.dirname, "../../dist/cli.js");

test("the bundle harmonizes: JSONC kept, agent guarded by the project's denies", async () => {
  const dir = await repo({
    "CLAUDE.md": "# Rules\n",
    "opencode.jsonc": '{\n  // team\n  "model": "anthropic/claude-sonnet-5-5",\n}\n',
    ".claude/settings.json": JSON.stringify({ permissions: { deny: ["Read(./.env)"] } }),
    ".claude/agents/rev.md": "---\nname: rev\ndescription: r\ntools: Read\n---\nBody\n",
  });
  const env = { XDG_CACHE_HOME: join(dir, ".cache"), CLAUDE_CONFIG_DIR: join(dir, ".home") };
  const run = await execa("node", [BIN, "harmonize", ".", "-y"], { cwd: dir, env });
  expect(run.exitCode).toBe(0);
  const config = await readFile(join(dir, "opencode.jsonc"), "utf8");
  expect(config).toContain("// team");
  expect(config).toContain('"permissions"');
  const agent = await readFile(join(dir, ".opencode/agents/rev.md"), "utf8");
  expectAgent(agent);
  const perms = split(agent).data["permissions"] as unknown[];
  expect(perms.at(-1)).toStrictEqual({ action: "read", resource: ".env", effect: "deny" });
  await cleanup(dir);
});
