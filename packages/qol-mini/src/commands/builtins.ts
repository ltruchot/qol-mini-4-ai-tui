import { join } from "node:path";
import type { Manifest } from "../core/schema/manifest.ts";
import type { Answers } from "../core/types.ts";
import { configDir } from "../io/config-dir.ts";
import { KAIZEN } from "../kit/files.ts";
import { VERSION } from "../version.ts";

// The command the kaizen skill runs to release /compact
export function releaseCommand(node: string = process.execPath, dir = configDir()): string {
  return `"${node}" "${join(dir, KAIZEN)}" --release`;
}

// The kit version a skill pins in the `qol-mini` commands it runs
const PIN = "QOL_MINI_VERSION";
const BUILTINS: Record<string, () => string> = {
  RELEASE_COMMAND: releaseCommand,
  [PIN]: () => VERSION,
};

// Placeholders the kit computes: never prompted, never taken from the lock,
// except the pin under check: `recorded` holds the version the copy was
// rendered with, and a kit upgrade alone changes no installed copy
export function builtinAnswers(manifest: Manifest, recorded: Answers = {}): Answers {
  const declared = manifest.placeholders.filter((p) => Object.hasOwn(BUILTINS, p.name));
  const value = (name: string): string =>
    (name === PIN ? recorded[name] : undefined) ?? BUILTINS[name]?.() ?? "";
  return Object.fromEntries(declared.map((p) => [p.name, value(p.name)]));
}
