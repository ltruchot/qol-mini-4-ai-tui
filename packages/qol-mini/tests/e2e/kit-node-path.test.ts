import { existsSync } from "node:fs";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { onlyNodeDiffers } from "../../src/kit/node-path.ts";
import { kit } from "../helpers/kit.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

const SKILL = "skills/kaizen/SKILL.md";

test("only the quoted interpreter path may differ", () => {
  expect(onlyNodeDiffers('run "/old/node" x', 'run "/new/node" x', "/new/node")).toBe(true);
  expect(onlyNodeDiffers('run "/old/node" y', 'run "/new/node" x', "/new/node")).toBe(false);
  expect(onlyNodeDiffers('run "" x', 'run "/new/node" x', "/new/node")).toBe(false);
  expect(onlyNodeDiffers("same", "same", "/new/node")).toBe(false);
});

test("a skill naming another node is rewritten without --replace; an edit is refused", async () => {
  const target = await tmpDir();
  await kit(target, ["install"]);
  const file = join(target, SKILL);
  const shipped = await readFile(file, "utf8");
  await writeFile(file, shipped.replaceAll(`"${process.execPath}"`, '"/old/v20/bin/node"'));
  const run = await kit(target, ["install"]);
  expect(run.code).toBe(0);
  expect(run.out).toContain(`replaced      ${SKILL}`);
  expect(await readFile(file, "utf8")).toBe(shipped);
  await appendFile(file, "edited\n");
  expect((await kit(target, ["install"])).code).toBe(1);
  await writeFile(file, shipped.replaceAll(`"${process.execPath}"`, '"/old/v20/bin/node"'));
  expect((await kit(target, ["uninstall"])).out).toContain(`removed       ${SKILL}`);
  expect(existsSync(file)).toBe(false);
  await cleanup(target);
});
