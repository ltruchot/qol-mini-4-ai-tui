import { join } from "node:path";
import type { Manifest } from "../core/schema/manifest.ts";
import type { Answers } from "../core/types.ts";
import { configDir } from "../io/config-dir.ts";
import { KAIZEN } from "../kit/files.ts";
import { VERSION } from "../version.ts";

// The command the global kaizen copy runs to release /compact: the delivered
// hook by absolute path, in a file that never leaves the machine
export function releaseCommand(node: string = process.execPath, dir = configDir()): string {
  return `"${node}" "${join(dir, KAIZEN)}" --release`;
}

// The kit version a skill pins in the `qol-mini` commands it runs
const PIN = "QOL_MINI_VERSION";

// Placeholders the kit computes: never prompted, never taken from the lock,
// except the pin under check: `recorded` holds the version the copy was
// rendered with, and a kit upgrade alone changes no installed copy. A skill
// copy in a project is committed: its release runs the CLI at the pin.
export function builtinAnswers(manifest: Manifest, recorded: Answers = {}): Answers {
  const pin = recorded[PIN] ?? VERSION;
  const values: Answers = { [PIN]: pin, RELEASE_COMMAND: `npx qol-mini@${pin} kaizen release` };
  const declared = manifest.placeholders.filter((p) => Object.hasOwn(values, p.name));
  return Object.fromEntries(declared.map((p) => [p.name, values[p.name] ?? ""]));
}
