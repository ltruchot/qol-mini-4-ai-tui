import { expect, test } from "vite-plus/test";
import { cleanup } from "../helpers/tmp.ts";
import { healthy, vitals } from "../helpers/vitals.ts";

const GOLDEN = `[pass] AM01 AGENTS.md: AGENTS.md is at the root
[pass] AM02 CLAUDE.md: absent: nothing shadows AGENTS.md
[pass] AM03 .claude/CLAUDE.md: absent: nothing shadows AGENTS.md
[pass] AM04 CLAUDE.local.md: absent
[pass] AM05 AGENTS.md: 3 lines (warn above 200)
[pass] AM06 AGENTS.md: 50 bytes (fail above 4194304)
[pass] AM07 AGENTS.md: opens by sending each session to TODO.md
[pass] AM08 .claude/skills/kaizen/SKILL.md: kaizen skill present
[pass] AM09 .: no nested CLAUDE.md holds its own rules
[pass] AM10 .: every nested instruction file is within budget
[n/a] AM11 .claude/rules: no rules files
[pass] AM12 .: no instruction file that an agent skips
[n/a] AM13 .: no instruction file below the root
[n/a] AM14 (user scope) ..: skipped: --repo-only
[n/a] AM15 (user scope) ..: skipped: --repo-only
[n/a] AM16 .: no @path import
[pass] AM17 .: 1 instruction file: headings and short blocks
[pass] AM18 .: 1 instruction file: emphasis within budget
[pass] AM19 .: every repository path and link that the instruction files name resolves
[n/a] AM20 .claude/rules: no rules files
[n/a] AM21 (user scope) /etc/claude-code: skipped: --repo-only
agents-md gate passed: 0 fail, 0 warn, 14 pass, 7 n/a`;

test("one gate on a healthy repository: the native output, exit 0, a silent stderr", async () => {
  const dir = await healthy();
  const run = await vitals(["agents-md", dir, "--repo-only"]);
  await cleanup(dir);
  expect(run).toStrictEqual({ code: 0, out: GOLDEN, err: "" });
});

test("no gate named: every gate runs, in order", async () => {
  const dir = await healthy();
  const run = await vitals([dir, "--repo-only"]);
  await cleanup(dir);
  expect(run.code).toBe(0);
  expect(run.out.indexOf("agents-md gate passed")).toBeGreaterThan(0);
  expect(run.out.indexOf("skills gate passed")).toBeGreaterThan(run.out.indexOf("agents-md gate"));
});
