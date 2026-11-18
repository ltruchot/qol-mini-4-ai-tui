import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { cleanup } from "../helpers/tmp.ts";
import { healthy, vitals } from "../helpers/vitals.ts";

test("a failing probe exits 1 and the other gate still runs", async () => {
  const dir = await healthy({ "pkg/AGENTS.md": "# pkg\n", "pkg/CLAUDE.md": "# other\n" });
  const run = await vitals([dir, "--repo-only"]);
  await cleanup(dir);
  expect(run.code).toBe(1);
  expect(run.out).toContain("[fail] AM09 pkg/CLAUDE.md");
  expect(run.out).toContain("agents-md gate failed");
  expect(run.out).toContain("skills gate passed");
});

test("a repository that cannot be read exits 2", async () => {
  const dir = await healthy();
  const run = await vitals(["agents-md", join(dir, "nope")]);
  await cleanup(dir);
  expect(run.code).toBe(2);
  expect(run.err).toContain("cannot read");
});

test("the user scope reads the home directory the host names", async () => {
  const dir = await healthy();
  const run = await vitals(["skills", dir]);
  await cleanup(dir);
  expect(run.code).toBe(0);
  expect(run.out).not.toContain("skipped: --repo-only");
});

test("two repositories are refused, and help names the gates", async () => {
  const two = await vitals(["a", "b"]);
  expect(two.code).toBe(1);
  expect(two.err).toContain("one repository at a time");
  const help = await vitals(["--help"]);
  expect(help.out).toContain("[agents-md|skills] [path]");
});
