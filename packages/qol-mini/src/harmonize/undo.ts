import type { Harmony } from "../core/schema/harmony.ts";
import { readLock, writeLock } from "../io/lock.ts";
import { paths } from "../io/paths.ts";
import { clearStore } from "./backup.ts";
import { undoOp } from "./undo-ops.ts";
import { undoArtifact } from "./undo-slot.ts";

// Undo replays the recorded moves backwards and restores the generated files
// from their slots, then drops the harmonize section and the backup store.
// The lock keeps its skills section.
export async function undo(root: string, harmony: Harmony): Promise<string[]> {
  const warnings: string[] = [];
  for (const op of harmony.ops.toReversed()) await undoOp(root, op, warnings);
  for (const [rel, art] of Object.entries(harmony.artifacts).toReversed())
    await undoArtifact(root, rel, art, warnings);
  const lock = await readLock(paths(root));
  Reflect.deleteProperty(lock, "harmonize");
  await writeLock(paths(root), lock);
  await clearStore(root);
  return warnings;
}
