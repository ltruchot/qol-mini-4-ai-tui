import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { writeFileAtomic } from "../../src/io/atomic.ts";
import { saveNamed } from "../../src/kit/save-settings.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

test("writeFileAtomic renames a temp, keeps the mode, writes through a symlink", async () => {
  const root = await tmpDir("qol-mini-atomic-");
  const real = join(root, "real.json");
  writeFileSync(real, "{}");
  chmodSync(real, 0o600);
  symlinkSync(real, join(root, "settings.json"));
  saveNamed(root, "settings.json", { model: "opus" });
  expect(lstatSync(join(root, "settings.json")).isSymbolicLink()).toBe(true);
  expect(JSON.parse(readFileSync(real, "utf8"))).toStrictEqual({ model: "opus" });
  expect(statSync(real).mode & 0o777).toBe(0o600);
  writeFileAtomic(join(root, "fresh.json"), "1");
  expect(readFileSync(join(root, "fresh.json"), "utf8")).toBe("1");
  mkdirSync(join(root, "dir"));
  writeFileSync(join(root, "dir", "x"), "");
  expect(() => {
    writeFileAtomic(join(root, "dir"), "2");
  }).toThrow(/EISDIR|EPERM|ENOTEMPTY|EEXIST/);
  expect(readdirSync(root).filter((n) => n.endsWith(".tmp"))).toStrictEqual([]);
  await cleanup(root);
});
