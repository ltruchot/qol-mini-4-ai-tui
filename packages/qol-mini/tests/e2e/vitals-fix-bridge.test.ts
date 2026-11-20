import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { put } from "../helpers/harmony.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";
import { HANDOFF, healthy, vitals } from "../helpers/vitals.ts";

const BRIDGE = "run: qol-mini harmonize --only rules --rules bridge";
const cache = (dir: string): Record<string, string> => ({ XDG_CACHE_HOME: join(dir, ".cache") });

test("a local file: --fix writes a bridge CLAUDE.md and the audit passes after", async () => {
  const dir = await healthy({ "CLAUDE.local.md": "# Mine\n" });
  const run = await vitals([dir, "--repo-only", "--fix"], cache(dir));
  expect(run.out).toContain(`${BRIDGE} ${dir}\n`);
  expect(run.out).toContain("[pass] AM04 CLAUDE.local.md");
  expect(run.code).toBe(0);
  expect(readFileSync(join(dir, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
  await cleanup(dir);
});

test("a lone CLAUDE.md beside a CLAUDE.local.md moves behind a bridge", async () => {
  const dir = await tmpDir("qol-mini-fix-");
  await put(dir, { "CLAUDE.md": HANDOFF, "CLAUDE.local.md": "# Mine\n", "TODO.md": "# TODO\n" });
  const run = await vitals([dir, "--repo-only", "--fix"], cache(dir));
  expect(run.out).toContain(`${BRIDGE} ${dir}\n`);
  expect(run.out).toContain("agents-md gate passed: 0 fail, 0 warn");
  expect(run.code).toBe(0);
  expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(HANDOFF);
  await cleanup(dir);
});

test("a dry run quotes a path a shell would split", async () => {
  const root = await tmpDir("qol-mini-fix-");
  const dir = join(root, "my project");
  await put(dir, { "CLAUDE.md": HANDOFF, "TODO.md": "# TODO\n" });
  const dry = await vitals([dir, "--repo-only", "--fix", "--dry-run"]);
  const quoted = process.platform === "win32" ? `"${dir}"` : `'${dir}'`;
  expect(dry.out).toContain(`run: qol-mini harmonize --only rules ${quoted}\n`);
  await cleanup(root);
});

test("--dry-run without --fix, and --json with --fix, are refused", async () => {
  const dir = await healthy();
  const dry = await vitals([dir, "--dry-run"]);
  expect(dry.err).toContain("--dry-run goes with --fix");
  const json = await vitals([dir, "--fix", "--json"]);
  expect([dry.code, json.code]).toStrictEqual([1, 1]);
  expect(json.err).toContain("--json and --fix do not combine");
  await cleanup(dir);
});
