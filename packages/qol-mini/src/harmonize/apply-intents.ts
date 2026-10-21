import { lstat, readlink, rename, rm } from "node:fs/promises";
import type { UndoOp } from "../core/schema/harmony.ts";
import { exists } from "../io/fs.ts";
import { saveSlot } from "./backup.ts";
import { bridgeOrLink, bridge } from "./apply-bridge.ts";
import type { Intent } from "./plan-types.ts";
import { rootJoin } from "./write.ts";

export type Slots = { next: number };

// Run the rule moves in order, recording what undo replays backwards; a
// removal or a write keeps what it replaces
export async function runIntents(
  root: string,
  intents: Intent[],
  slots: Slots,
): Promise<{ ops: UndoOp[]; warnings: string[] }> {
  const ops: UndoOp[] = [];
  const warnings: string[] = [];
  for (const intent of intents) {
    const file = rootJoin(root, intent.path);
    if (intent.op === "mv") {
      await rename(file, rootJoin(root, intent.to ?? ""));
      ops.push({ op: "mv", path: intent.path, to: intent.to });
    } else if (intent.op === "unlink") ops.push(...(await remove(root, file, intent.path, slots)));
    else if (intent.op === "write")
      ops.push(...(await bridge(root, file, intent.path, slots, intent.content)));
    else {
      const out = await bridgeOrLink(root, file, intent, slots);
      ops.push(...out.ops);
      if (out.warn !== "") warnings.push(out.warn);
    }
  }
  return { ops, warnings };
}

// A removed file keeps its bytes in a slot, a removed symlink its target
async function remove(root: string, file: string, rel: string, slots: Slots): Promise<UndoOp[]> {
  if (!(await exists(file))) return [];
  const stat = await lstat(file);
  if (stat.isSymbolicLink()) {
    const to = await readlink(file);
    await rm(file, { force: true });
    return [{ op: "rmsym", path: rel, to }];
  }
  slots.next += 1;
  await saveSlot(root, slots.next, file);
  await rm(file, { force: true });
  return [{ op: "unlink", path: rel, slot: slots.next }];
}
