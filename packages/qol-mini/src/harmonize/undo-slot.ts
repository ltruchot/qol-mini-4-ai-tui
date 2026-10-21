import { loadSlot } from "./backup.ts";
import type { UndoOp } from "../core/schema/harmony.ts";
import { stepLine } from "./undo-lines.ts";
import type { Step } from "./undo-plan.ts";
import { link, prune, put, rootJoin } from "./write.ts";

// A file we removed comes back from its slot; a bridge we created just goes.
// A symlink that would not relink (Windows without Developer Mode) is named.
export async function withSlot(
  root: string,
  op: UndoOp,
  file: string,
  fresh: () => Promise<void>,
): Promise<void> {
  if (op.slot === undefined) {
    await fresh();
    return;
  }
  await put(file, await loadSlot(root, op.slot));
}

// A generated file: created by us disappears, replaced by us comes back, one
// edited since the run or with no backup stays and is named
export async function undoStep(root: string, step: Step, warnings: string[]): Promise<void> {
  const file = rootJoin(root, step.rel);
  if (step.action === "delete") await prune(file, root);
  else if (step.action === "restore" && step.art.slot !== undefined)
    await put(file, await loadSlot(root, step.art.slot));
  else warnings.push(stepLine(step));
}

export async function linkOrWarn(target: string, file: string, warnings: string[]): Promise<void> {
  try {
    await link(target, file);
  } catch {
    warnings.push(`could not restore the symlink ${file}: platform refused it`);
  }
}
