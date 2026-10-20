import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { packageRoot } from "../io/bank-dir.ts";
import type { Chosen } from "../kit/options.ts";
import { KAIZEN_COMMAND, PLUGIN_FILES } from "./files.ts";

// A skill is not a command in OpenCode: the kaizen ritual is typed by hand,
// so it needs a slash command that loads the skill. `$ARGUMENTS` stays empty
// in the common case; the fallback appends nothing.
const KAIZEN_MD = `---
description: Review this session's friction, update the TODO handoff, release /compact
---

Load the kaizen skill with the skill tool and follow it in full. $ARGUMENTS
`;

// The files this install owns in the OpenCode config dir, as relative path ->
// exact bytes. The plugin ships as-is: OpenCode loads it, nothing is built.
export async function openPayloads(chosen: Chosen): Promise<Map<string, Buffer>> {
  const source = join(packageRoot(), "opencode");
  const files = new Map<string, Buffer>();
  for (const relative of PLUGIN_FILES)
    files.set(relative, await readFile(join(source, basename(relative))));
  if (chosen.kaizen) files.set(KAIZEN_COMMAND, Buffer.from(KAIZEN_MD));
  return files;
}
