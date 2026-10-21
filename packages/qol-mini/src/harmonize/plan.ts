import type { Harmony } from "../core/schema/harmony.ts";
import { detect } from "./detect.ts";
import { layout } from "./layout.ts";
import { notesFor } from "./plan-notes.ts";
import { keepFiles, selector, sharedWarning, sideOf } from "./plan-only.ts";
import { configs, markdowns, type Ctx } from "./plan-parts.ts";
import { readConfigs } from "./plan-shared.ts";
import type { Plan, PlanOpts } from "./plan-types.ts";
import { planRules } from "./slice-rules.ts";

export type { PlanOpts } from "./plan-types.ts";

// One pass over the repo: detect the sides, plan the rule moves, convert what
// the source of truth holds, keep what `--only` selects. Nothing is written.
export async function plan(
  root: string,
  opts: PlanOpts,
  harmony: Harmony | undefined,
): Promise<Plan> {
  const lay = await layout(root);
  const det = await detect(lay, root);
  const on = selector(opts.only);
  const from = sideOf(opts, harmony, det);
  const c: Ctx = { from, lay, det, prev: harmony?.artifacts ?? {}, replace: opts.replace, on };
  // A re-run keeps the recorded mode unless `--rules` names another; rules
  // left out of `--only` keep it whatever the flag: nothing moved
  const recorded = harmony?.rules ?? "pure";
  const mode = on("rules") ? (opts.rules ?? recorded) : recorded;
  const rules = on("rules")
    ? planRules(det.state, mode, opts.replace, from)
    : { intents: [], conflict: null };
  const reads = await readConfigs(lay);
  const cfg = configs(c, reads);
  const mds = await markdowns(c);
  const settings = reads.settings.state === "ok" ? reads.settings.data : undefined;
  const notes = notesFor(det, from, mode, settings, rules.intents);
  const warnings = [...cfg.warnings, ...mds.warnings, ...notes.warnings];
  return {
    from,
    rulesMode: mode,
    state: det.state,
    intents: rules.intents,
    files: keepFiles([...cfg.files, ...mds.planned], on, lay.ocConfig),
    warnings: [...warnings, ...sharedWarning(on, from)],
    notes: [...notes.notes, ...mds.notes],
    conflicts: rules.conflict === null ? cfg.conflicts : [rules.conflict, ...cfg.conflicts],
  };
}
