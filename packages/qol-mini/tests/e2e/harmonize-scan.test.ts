import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { harm, put } from "../helpers/harmony.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";
import type { ScanHit } from "../../src/harmonize/scan.ts";

async function root(): Promise<string> {
  const dir = await tmpDir("qol-mini-scan-");
  for (const rel of [
    "repos/claude-side/.git",
    "repos/pure/.git",
    "repos/plain",
    "repos/skipme/node_modules/deep/.git",
  ])
    await mkdir(join(dir, rel), { recursive: true });
  await put(dir, {
    "repos/claude-side/CLAUDE.md": "# R\n",
    "repos/pure/AGENTS.md": "# R\n",
  });
  return dir;
}

test("scan lists repos under the roots, skips the rest, writes nothing", async () => {
  const dir = await root();
  const run = await harm(dir, ["scan", "."]);
  expect(run.code).toBe(0);
  expect(run.out).toContain("claude-side");
  expect(run.out).toContain("pure");
  expect(run.out).not.toContain("plain");
  expect(run.out).toContain("qol-mini harmonize ");
  await cleanup(dir);
});

test("scan --json reports each repo and refuses the whole disk", async () => {
  const dir = await root();
  const json = JSON.parse((await harm(dir, ["scan", ".", "--json"])).out) as {
    hits: ScanHit[];
    errors: string[];
  };
  expect(json.hits).toHaveLength(2);
  expect(json.hits.map((h) => h.state).toSorted()).toStrictEqual(["claude-only", "pure"]);
  const refused = await harm(dir, ["scan", "/", "--json"]);
  expect((JSON.parse(refused.out) as { errors: string[] }).errors[0]).toContain(
    "refusing to scan /",
  );
  await cleanup(dir);
});
