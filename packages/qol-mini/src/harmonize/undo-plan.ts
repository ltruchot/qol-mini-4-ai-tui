import { readFile } from "node:fs/promises";
import { hashBytes } from "../core/hash/file.ts";
import type { Artifact, Harmony, UndoOp } from "../core/schema/harmony.ts";
import { exists } from "../io/fs.ts";
import { rootJoin } from "./write.ts";

// `edited`: changed since the run, left in place. `orphan`: replaced with no
// backup slot, left in place.
export type Action = "delete" | "restore" | "edited" | "orphan";
export type Step = { rel: string; art: Artifact; action: Action };
export type UndoPlan = { ops: UndoOp[]; steps: Step[] };

// What undo does, in order, read from disk with nothing written. A generated
// file edited since the run stays unless `replace`.
export async function planUndo(
  root: string,
  harmony: Harmony,
  replace: boolean,
): Promise<UndoPlan> {
  const steps: Step[] = [];
  for (const [rel, art] of Object.entries(harmony.artifacts).toReversed())
    steps.push({ rel, art, action: await actionOf(rootJoin(root, rel), art, replace) });
  return { ops: harmony.ops.toReversed(), steps };
}

async function actionOf(file: string, art: Artifact, replace: boolean): Promise<Action> {
  const edited = (await exists(file)) && hashBytes(await readFile(file)) !== art.hash;
  if (edited && !replace) return "edited";
  if (art.created) return "delete";
  return art.slot === undefined ? "orphan" : "restore";
}
