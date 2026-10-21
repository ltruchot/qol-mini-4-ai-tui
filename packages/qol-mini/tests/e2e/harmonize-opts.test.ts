import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { z } from "zod";
import { exists } from "../../src/io/fs.ts";
import { harm, repo } from "../helpers/harmony.ts";
import { parseAs } from "../helpers/json.ts";
import { cleanup } from "../helpers/tmp.ts";

const Out = z.object({ from: z.string(), written: z.boolean() });
type Out = z.infer<typeof Out>;
const jsonOut = (out: string): Out => parseAs(Out, out.trim().split("\n").at(-1) ?? "");
const PERM = JSON.stringify({ permissions: { allow: ["Bash(git:*)"] } });
const BAD = { "--from": "cursor", "--rules": "copy", "--only": "hooks" };

test("an unknown --from, --rules or --only exits 1 and names the flag", async () => {
  const dir = await repo({ "CLAUDE.md": "# Rules\n" });
  for (const [flag, value] of Object.entries(BAD)) {
    const run = await harm(dir, [".", flag, `rules,${value}`.slice(flag === "--only" ? 0 : 6)]);
    expect(run.code).toBe(1);
    expect(run.out).toContain(`${flag} ${value}: expected one of`);
  }
  expect(await exists(join(dir, "AGENTS.md"))).toBe(false);
  await cleanup(dir);
});

test("--from auto detects again over the recorded side", async () => {
  const dir = await repo({
    "CLAUDE.md": "# Rules\n",
    "opencode.json": '{"mcp":{}}\n',
    ".opencode/commands/x.md": "---\ndescription: x\n---\nBody\n",
  });
  expect((await harm(dir, [".", "--from", "claude"])).code).toBe(0);
  expect(jsonOut((await harm(dir, [".", "--json", "--dry-run"])).out).from).toBe("claude");
  const auto = await harm(dir, [".", "--json", "--dry-run", "--from", "auto"]);
  expect(jsonOut(auto.out).from).toBe("opencode");
  await cleanup(dir);
});

test("--json prints the plan and writes unless --dry-run", async () => {
  const dir = await repo({ ".claude/settings.json": PERM });
  expect(jsonOut((await harm(dir, [".", "--json", "--dry-run"])).out).written).toBe(false);
  expect(await exists(join(dir, "opencode.json"))).toBe(false);
  const run = await harm(dir, [".", "--json"]);
  expect(run.code).toBe(0);
  expect(jsonOut(run.out).written).toBe(true);
  expect(await exists(join(dir, "opencode.json"))).toBe(true);
  expect((await harm(dir, ["check"])).code).toBe(0);
  await cleanup(dir);
});
