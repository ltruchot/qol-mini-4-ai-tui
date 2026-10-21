import { rename } from "node:fs/promises";
import type { UndoOp } from "../core/schema/harmony.ts";
import { prune, rootJoin } from "./write.ts";
import { linkOrWarn, withSlot } from "./undo-slot.ts";

// Replay one recorded move backwards: a mv renames home, a file we removed
// comes back from its slot, a bridge we created just goes, a removed symlink
// is relinked, a symlink we created goes.
export async function undoOp(root: string, op: UndoOp, warnings: string[]): Promise<void> {
  const file = rootJoin(root, op.path);
  if (op.op === "mv") await rename(rootJoin(root, op.to ?? ""), file);
  else if (op.op === "write") await withSlot(root, op, file, () => prune(file, root));
  else if (op.op === "unlink") await withSlot(root, op, file, () => Promise.resolve());
  else if (op.op === "symlink") await prune(file, root);
  else await linkOrWarn(op.to ?? "AGENTS.md", file, warnings);
}
