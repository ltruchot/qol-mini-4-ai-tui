import { join } from "node:path";
import { execa } from "execa";
import { expect, test } from "vite-plus/test";
import { cleanup } from "../helpers/tmp.ts";
import { healthy } from "../helpers/vitals.ts";

// The published bundle, not the sources: it finds wasm/ from dist/
const BIN = join(import.meta.dirname, "../../dist/cli.js");

test("the bundle runs both gates from the directory it is called in", async () => {
  const dir = await healthy();
  const run = await execa("node", [BIN, "vitals", "--repo-only"], { cwd: dir });
  await cleanup(dir);
  expect(run.stdout).toContain("agents-md gate passed");
  expect(run.stdout).toContain("skills gate passed");
  expect(run.stderr).toBe("");
});
