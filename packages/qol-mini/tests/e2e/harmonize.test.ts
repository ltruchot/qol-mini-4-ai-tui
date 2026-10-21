import { readFile } from "node:fs/promises";
import { exists } from "../../src/io/fs.ts";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { harm, repo } from "../helpers/harmony.ts";
import { readLockFile } from "../helpers/json.ts";
import { cleanup } from "../helpers/tmp.ts";

const FILES = {
  "CLAUDE.md": "# Rules\n",
  ".claude/settings.json": JSON.stringify({
    permissions: { allow: ["Read", "Bash(git:*)"], deny: ["Read(./.env)"] },
    hooks: { SessionStart: [] },
  }),
  ".claude/commands/deploy.md":
    "---\ndescription: d\nargument-hint: [env]\nallowed-tools: [Read, Bash(git:*)]\n---\nBody $ARGUMENTS\n",
  ".claude/agents/reviewer.md":
    "---\nname: reviewer\ndescription: r\ntools: Read, Grep\ncolor: yellow\n---\nBody\n",
  ".mcp.json": JSON.stringify({
    mcpServers: { ci: { command: "npx", args: ["-y", "s"], env: { K: "${X}" } } },
  }),
};

test("a claude code repo gains a full opencode side, pure AGENTS.md rules", async () => {
  const dir = await repo(FILES);
  expect((await harm(dir, ["."])).code).toBe(0);
  expect(await readFile(join(dir, "AGENTS.md"), "utf8")).toBe("# Rules\n");
  expect(await exists(join(dir, "CLAUDE.md"))).toBe(false);
  const oc = JSON.parse(await readFile(join(dir, "opencode.json"), "utf8")) as {
    permission: unknown[];
    mcp: { ci: { command: string[] } };
  };
  expect(oc.permission).toContainEqual({ action: "read", resource: "./.env", effect: "deny" });
  expect(oc.mcp.ci.command).toStrictEqual(["npx", "-y", "s"]);
  const cmd = await readFile(join(dir, ".opencode/commands/deploy.md"), "utf8");
  expect(cmd).toContain("tools:");
  expect(cmd).toContain("Body $ARGUMENTS");
  const agent = await readFile(join(dir, ".opencode/agents/reviewer.md"), "utf8");
  expect(agent).toContain("mode: subagent");
  const lock = await readLockFile(join(dir, ".claude/qol-mini.lock.json"));
  expect(lock.harmonize?.from).toBe("claude");
  expect(lock.harmonize?.rules).toBe("pure");
  const second = await harm(dir, ["."]);
  expect(second.code).toBe(0);
  expect(second.out).toContain("nothing to do");
  await cleanup(dir);
});
