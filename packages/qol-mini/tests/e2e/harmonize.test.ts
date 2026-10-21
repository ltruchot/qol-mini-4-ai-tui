import { readFile } from "node:fs/promises";
import { exists } from "../../src/io/fs.ts";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { harm, repo } from "../helpers/harmony.ts";
import { readLockFile } from "../helpers/json.ts";
import { expectAgent, expectCommand, expectConfig } from "../helpers/opencode.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  "CLAUDE.md": "# Rules\n",
  ".claude/settings.json": JSON.stringify({
    permissions: { allow: ["Read", "Bash(git:*)"], deny: ["Read(./.env)"] },
    hooks: { SessionStart: [] },
  }),
  ".claude/commands/deploy.md":
    "---\ndescription: d\nmodel: haiku\nargument-hint: [env]\nallowed-tools: [Read]\n---\nBody $ARGUMENTS\n",
  ".claude/agents/reviewer.md":
    "---\nname: reviewer\ndescription: r\ntools: Read, Grep\ncolor: yellow\nmodel: sonnet\n---\nBody\n",
  ".mcp.json": JSON.stringify({
    mcpServers: { ci: { command: "npx", args: ["-y", "s"], env: { K: "${X}" } } },
  }),
};

test("a claude code repo gains an opencode side OpenCode 2.1 decodes", async () => {
  const dir = await repo(FILES);
  expect((await harm(dir, ["."])).code).toBe(0);
  expect(await readFile(join(dir, "AGENTS.md"), "utf8")).toBe("# Rules\n");
  expect(await exists(join(dir, "CLAUDE.md"))).toBe(false);
  const oc = JSON.parse(await readFile(join(dir, "opencode.json"), "utf8")) as Record<
    string,
    unknown
  >;
  expectConfig(oc);
  expect(oc).toMatchObject({
    permissions: [{}, {}, { action: "read", resource: ".env", effect: "deny" }],
    mcp: { servers: { ci: { command: ["npx", "-y", "s"], environment: { K: "{env:X}" } } } },
  });
  const cmd = await readFile(join(dir, ".opencode/commands/deploy.md"), "utf8");
  expectCommand(cmd);
  expect(cmd).toContain("model: anthropic/claude-haiku-5-5");
  expect(cmd).toContain("Body $ARGUMENTS");
  const agent = await readFile(join(dir, ".opencode/agents/reviewer.md"), "utf8");
  expectAgent(agent);
  expect(agent).toContain('color: "#ffc53d"');
  const lock = await readLockFile(join(dir, ".claude/qol-mini.lock.json"));
  expect(lock.harmonize?.from).toBe("claude");
  expect((await harm(dir, ["."])).out).toContain("nothing to do");
  await cleanup(dir);
});
