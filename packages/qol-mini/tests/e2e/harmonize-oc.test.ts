import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { harm, repo } from "../helpers/harmony.ts";
import { cleanup } from "../helpers/tmp.ts";

// The shapes OpenCode users write: a legacy `permission` map, flat MCP
// entries, `{env:}` references, comments in opencode.jsonc
const FILES = {
  "AGENTS.md": "# Rules\n",
  "opencode.jsonc": `{
  // team config
  "permission": { "bash": { "*": "ask", "git *": "allow" }, "edit": "deny" },
  "mcp": { "ci": { "type": "local", "command": ["npx", "-y", "s"], "environment": { "K": "{env:X}" } } },
}`,
  ".opencode/commands/deploy.md": "---\ndescription: d\nsubtask: true\n---\nBody\n",
  ".opencode/agents/reviewer.md":
    '---\ndescription: r\nmode: subagent\npermission:\n  "*": deny\n  read: allow\n---\nBody\n',
};

test("an opencode repo gains a claude code side", async () => {
  const dir = await repo(FILES);
  expect((await harm(dir, ["."])).code).toBe(0);
  const read = (f: string): Promise<string> => readFile(join(dir, f), "utf8");
  expect(JSON.parse(await read(".claude/settings.json"))).toStrictEqual({
    permissions: {
      allow: ["Bash(git *)"],
      ask: ["Bash"],
      deny: ["Edit"],
    },
  });
  expect(JSON.parse(await read(".mcp.json"))).toStrictEqual({
    mcpServers: {
      ci: {
        command: "npx",
        args: ["-y", "s"],
        env: { K: "${X}" },
      },
    },
  });
  expect(await read(".claude/commands/deploy.md")).toContain("context: fork");
  const agent = await read(".claude/agents/reviewer.md");
  expect(agent).toContain("name: reviewer");
  expect(agent).toContain("- Read");
  expect(await read("opencode.jsonc")).toContain("// team config");
  expect((await harm(dir, ["."])).out).toContain("nothing to do");
  await cleanup(dir);
});
