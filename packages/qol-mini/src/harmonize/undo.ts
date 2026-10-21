import type { Harmony } from "../core/schema/harmony.ts";
import { readLock, writeLock } from "../io/lock.ts";
import { paths } from "../io/paths.ts";
import { clearStore } from "./backup.ts";
import { undoOp } from "./undo-ops.ts";
import type { UndoPlan } from "./undo-plan.ts";
import { undoStep } from "./undo-slot.ts";

// Undo replays the recorded moves backwards and restores the generated files
// from their slots, then drops the harmonize section and the backup store.
// A file edited since the run stays tracked with the store: `undo --replace`
// finishes. The lock keeps its skills section.
export async function undo(root: string, p: UndoPlan, harmony: Harmony): Promise<string[]> {
  const warnings: string[] = [];
  for (const op of p.ops) await undoOp(root, op, warnings);
  for (const step of p.steps) await undoStep(root, step, warnings);
  const kept = p.steps.filter((s) => s.action === "edited");
  const lock = await readLock(paths(root));
  if (kept.length === 0) Reflect.deleteProperty(lock, "harmonize");
  else
    lock.harmonize = {
      ...harmony,
      ops: [],
      artifacts: Object.fromEntries(kept.map((s) => [s.rel, s.art])),
    };
  await writeLock(paths(root), lock);
  if (kept.length === 0) await clearStore(root);
  return warnings;
}
