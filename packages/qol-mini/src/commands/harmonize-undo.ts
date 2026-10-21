import type { CAC } from "cac";
import pc from "picocolors";
import { undo } from "../harmonize/undo.ts";
import { undoLines } from "../harmonize/undo-lines.ts";
import { planUndo } from "../harmonize/undo-plan.ts";
import { intro, outro, print, warn } from "../io/ui.ts";
import { confirmOrYes } from "../io/prompts/confirm.ts";
import { hContext, type HOpts } from "./harmonize-ctx.ts";

// Put the repo back where it was: the recorded moves replay backwards, the
// generated files restore from their slots or disappear, the lock keeps its
// skills section. --dry-run lists the steps and writes nothing.
export async function runUndo(project: string | undefined, opts: HOpts): Promise<number> {
  intro("qol-mini harmonize undo");
  const ctx = await hContext(opts, project);
  const harmony = ctx.lock.harmonize;
  if (harmony === undefined) {
    outro("nothing to undo");
    return 0;
  }
  const p = await planUndo(ctx.root, harmony, opts.replace === true);
  for (const line of undoLines(p)) print([line]);
  if (ctx.dryRun) {
    outro("dry run, nothing written");
    return 0;
  }
  if (!(await confirmOrYes(`undo the harmonization of ${ctx.root}?`, ctx.yes))) {
    outro("nothing written");
    return 0;
  }
  for (const warning of await undo(ctx.root, p, harmony)) warn(warning);
  const kept = p.steps.some((s) => s.action === "edited");
  outro(
    kept
      ? pc.yellow("edited files kept, undo --replace takes them back")
      : pc.green(`restored ${ctx.root}`),
  );
  return 0;
}

export function register(cli: CAC): void {
  cli.command("undo [project]", "Restore the repo to before the harmonization").action(runUndo);
}
