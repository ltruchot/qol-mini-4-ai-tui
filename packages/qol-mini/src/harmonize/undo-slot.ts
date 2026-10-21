import { loadSlot } from "./backup.ts";
import type { Artifact, UndoOp } from "../core/schema/harmony.ts";
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

// A generated file: created by us disappears, replaced by us comes back
export async function undoArtifact(
  root: string,
  rel: string,
  art: Artifact,
  warnings: string[],
): Promise<void> {
  const file = rootJoin(root, rel);
  if (art.created) {
    await prune(file, root);
    return;
  }
  if (art.slot === undefined) {
    warnings.push(`${rel}: no backup slot, left in place`);
    return;
  }
  await put(file, await loadSlot(root, art.slot));
}

export async function linkOrWarn(target: string, file: string, warnings: string[]): Promise<void> {
  try {
    await link(target, file);
  } catch {
    warnings.push(`could not restore the symlink ${file}: platform refused it`);
  }
}
