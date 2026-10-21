import { readFile } from "node:fs/promises";
import { exists } from "../../src/io/fs.ts";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { harm, repo } from "../helpers/harmony.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  "AGENTS.md": "# Rules\n",
  "opencode.json": JSON.stringify({
    permission: [{ action: "shell", resource: "git *", effect: "allow" }],
    mcp: { ci: { type: "local", command: ["npx", "-y", "s"], environment: { K: "${X}" } } },
  }),
  ".opencode/commands/deploy.md":
    "---\ndescription: d\ntools:\n  read: true\n  bash: true\n---\nBody\n",
  ".opencode/agents/reviewer.md":
    "---\nname: reviewer\ndescription: r\nmode: subagent\npermission:\n  read: allow\n---\nBody\n",
};

test("an opencode repo gains a full claude code side", async () => {
  const dir = await repo(FILES);
  const run = await harm(dir, ["."]);
  expect(run.code).toBe(0);
  expect(await exists(join(dir, "CLAUDE.md"))).toBe(false);
  const settings = JSON.parse(await readFile(join(dir, ".claude/settings.json"), "utf8")) as {
    permissions: Record<string, string[]>;
  };
  expect(settings.permissions["allow"]).toContain("Bash(git:*)");
  const mcp = JSON.parse(await readFile(join(dir, ".mcp.json"), "utf8")) as {
    mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }>;
  };
  expect(mcp.mcpServers["ci"]).toStrictEqual({
    command: "npx",
    args: ["-y", "s"],
    env: { K: "${X}" },
  });
  const cmd = await readFile(join(dir, ".claude/commands/deploy.md"), "utf8");
  expect(cmd).toContain("allowed-tools:");
  const agent = await readFile(join(dir, ".claude/agents/reviewer.md"), "utf8");
  expect(agent).toContain("tools:");
  const again = await harm(dir, ["."]);
  expect(again.out).toContain("nothing to do");
  await cleanup(dir);
});
