import { hashBytes } from "../core/hash/file.ts";
import type { Artifact } from "../core/schema/harmony.ts";
import { exists } from "../io/fs.ts";
import { saveSlot } from "./backup.ts";
import type { Slots } from "./apply-intents.ts";
import type { Planned } from "./plan-types.ts";
import { put } from "./write.ts";

// Write the generated files, backing up what they replace. Artifacts no longer
// planned stay tracked: a source that lost its file keeps its target on disk,
// and check reports the source as changed.
export async function writeFiles(
  root: string,
  files: Planned[],
  prev: Record<string, Artifact>,
  slots: Slots,
): Promise<Record<string, Artifact>> {
  const artifacts: Record<string, Artifact> = structuredClone(prev);
  for (const file of files) {
    const had = await exists(file.file);
    let slot: number | undefined;
    if (had) {
      slots.next += 1;
      slot = slots.next;
      await saveSlot(root, slot, file.file);
    }
    await put(file.file, file.bytes);
    artifacts[file.rel] = {
      kind: file.kind,
      created: !had,
      hash: hashBytes(file.bytes),
      sources: file.sources,
      mine: file.mine,
      ...(slot === undefined ? {} : { slot }),
    };
  }
  return artifacts;
}
