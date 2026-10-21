import type { UndoOp } from "../core/schema/harmony.ts";
import type { Step, UndoPlan } from "./undo-plan.ts";

const opLine = (op: UndoOp): string => {
  if (op.op === "mv") return `mv ${op.to ?? ""} -> ${op.path}`;
  if (op.op === "rmsym") return `symlink ${op.path} -> ${op.to ?? "AGENTS.md"}`;
  if (op.op === "symlink") return `rm ${op.path}`;
  if (op.slot !== undefined) return `restore ${op.path} from backup`;
  return op.op === "write" ? `rm ${op.path}` : `leave ${op.path} absent`;
};

export const stepLine = (step: Step): string => {
  if (step.action === "delete") return `rm ${step.rel}`;
  if (step.action === "restore") return `restore ${step.rel} from backup`;
  if (step.action === "edited")
    return `${step.rel}: edited since the run, left in place; undo --replace takes it back`;
  return `${step.rel}: no backup slot, left in place`;
};

// What undo does, one line per move or file, in order
export function undoLines(p: UndoPlan): string[] {
  return [...p.ops.map(opLine), ...p.steps.map(stepLine)];
}
