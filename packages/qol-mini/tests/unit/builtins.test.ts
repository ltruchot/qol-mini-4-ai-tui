import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { builtinAnswers } from "../../src/commands/builtins.ts";
import { readBank } from "../../src/core/bank/index.ts";
import type { Manifest } from "../../src/core/schema/manifest.ts";
import { VERSION } from "../../src/version.ts";

const bank = await readBank(join(import.meta.dirname, "../../skills"));
const manifest = (name: string): Manifest => {
  const skill = bank.find((s) => s.name === name);
  if (skill === undefined) throw new Error(`${name} is not in the bank`);
  return skill.manifest;
};

test("the pin is the kit version on install, the recorded one under check", () => {
  const review = manifest("agents-md-review");
  expect(builtinAnswers(review)).toStrictEqual({ QOL_MINI_VERSION: VERSION });
  expect(builtinAnswers(review, { QOL_MINI_VERSION: "0.1.0" })).toStrictEqual({
    QOL_MINI_VERSION: "0.1.0",
  });
});

test("the release command is computed even when the lock records one", () => {
  const answers = builtinAnswers(manifest("kaizen"), { RELEASE_COMMAND: "elsewhere" });
  expect(answers["RELEASE_COMMAND"]).not.toBe("elsewhere");
});

test.each(bank)("$name: every qol-mini package command is pinned", ({ files }) => {
  const text = [...files.values()].map((file) => file.bytes.toString("utf8")).join("\n");
  expect(text.match(/\b(?:npx|pnpm dlx) qol-mini(?!@)/gu)).toBeNull();
});
