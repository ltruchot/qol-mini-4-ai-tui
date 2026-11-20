import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { put } from "../helpers/harmony.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";
import { HANDOFF, healthy, vitals } from "../helpers/vitals.ts";

const RUN = "run: qol-mini harmonize --only rules";

// A repository whose rules live in CLAUDE.md alone: AM01 fails and names harmonize
async function claudeOnly(): Promise<{ dir: string; env: Record<string, string> }> {
  const dir = await tmpDir("qol-mini-fix-");
  await put(dir, { "CLAUDE.md": HANDOFF, "TODO.md": "# TODO\n" });
  return { dir, env: { XDG_CACHE_HOME: join(dir, ".cache") } };
}

test("a finding names its command, and a dry run writes nothing", async () => {
  const { dir, env } = await claudeOnly();
  const audit = await vitals(["agents-md", dir, "--repo-only"]);
  expect(audit.out).toContain(`       ${RUN}\n`);
  const dry = await vitals([dir, "--repo-only", "--fix", "--dry-run"], env);
  expect(dry.code).toBe(1);
  expect(dry.out).toContain(`${RUN} ${dir}\nrun: qol-mini skills install kaizen ${dir}\n`);
  expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
  await cleanup(dir);
});

test("--fix runs the named commands and the audit passes after", async () => {
  const { dir, env } = await claudeOnly();
  const run = await vitals([dir, "--repo-only", "--fix"], env);
  expect(run.out).toContain("mv CLAUDE.md -> AGENTS.md");
  expect(run.out).toContain("agents-md gate passed: 0 fail, 0 warn");
  expect(run.code).toBe(0);
  expect(existsSync(join(dir, "CLAUDE.md"))).toBe(false);
  expect(existsSync(join(dir, ".claude/skills/kaizen/SKILL.md"))).toBe(true);
  await cleanup(dir);
});

test("a command that refuses leaves the files and exits 1", async () => {
  const dir = await healthy({ "CLAUDE.md": "# Other rules\n" });
  const run = await vitals([dir, "--repo-only", "--fix"], { XDG_CACHE_HOME: join(dir, ".cache") });
  expect(run.out).toContain("nothing written");
  expect(run.out).toContain("[fail] AM02 CLAUDE.md");
  expect(run.code).toBe(1);
  expect(existsSync(join(dir, "CLAUDE.md"))).toBe(true);
  await cleanup(dir);
});
