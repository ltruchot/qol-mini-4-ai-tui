import type { Harmony } from "../core/schema/harmony.ts";
import { runIntents, type Slots } from "./apply-intents.ts";
import { writeFiles } from "./apply-files.ts";
import type { Plan } from "./plan-types.ts";
import { readLock, writeLock } from "../io/lock.ts";
import { paths } from "../io/paths.ts";

// Slot numbers only grow: a carried artifact keeps pointing at its own backup
function startSlot(prev: Harmony | undefined): Slots {
  const slots = Object.values(prev?.artifacts ?? {}).map((a) => a.slot ?? 0);
  const ops = (prev?.ops ?? []).map((o) => o.slot ?? 0);
  return { next: Math.max(0, ...slots, ...ops) };
}

// Execute a plan: rule moves first, generated files second, then the lock.
// The new moves append to the recorded ones: undo replays them all backwards.
// The lock keeps its skills section untouched.
export async function apply(
  root: string,
  p: Plan,
  prev: Harmony | undefined,
): Promise<{ harmony: Harmony; warnings: string[] }> {
  const slots = startSlot(prev);
  const intents = await runIntents(root, p.intents, slots);
  const artifacts = await writeFiles(root, p.files, prev?.artifacts ?? {}, slots);
  const harmony: Harmony = {
    version: 1,
    from: p.from,
    rules: p.rulesMode,
    artifacts,
    ops: [...(prev?.ops ?? []), ...intents.ops],
  };
  const lock = await readLock(paths(root));
  lock.harmonize = harmony;
  await writeLock(paths(root), lock);
  return { harmony, warnings: intents.warnings };
}
