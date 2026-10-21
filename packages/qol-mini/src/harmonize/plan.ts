import type { Artifact, Harmony, RuleMode, Side } from "../core/schema/harmony.ts";
import { detect } from "./detect.ts";
import { layout } from "./layout.ts";
import { convertBoth } from "./plan-mds.ts";
import { notesFor } from "./plan-notes.ts";
import { planConfigToCc } from "./plan-oc.ts";
import { planConfigToOc } from "./plan-cc.ts";
import { readConfigs } from "./plan-shared.ts";
import type { Plan } from "./plan-types.ts";
import { planRules } from "./slice-rules.ts";

export type PlanOpts = { from?: string | undefined; rules?: string | undefined; replace: boolean };

// One pass over the repo: detect the sides, plan the rule moves, convert what
// the source of truth holds. Nothing is written here.
export async function plan(
  root: string,
  opts: PlanOpts,
  harmony: Harmony | undefined,
): Promise<Plan> {
  const lay = await layout(root);
  const det = await detect(lay, root);
  const prev: Record<string, Artifact> = harmony?.artifacts ?? {};
  // The first run decides the source of truth; a re-run keeps it. A direction
  // flip would convert our own output back.
  let from: Side = harmony?.from ?? det.markers.from;
  if (opts.from === "opencode") from = "opencode";
  else if (opts.from === "claude") from = "claude";
  let mode: RuleMode = "pure";
  if (opts.rules === "bridge" || opts.rules === "symlink") mode = opts.rules;
  const rules = planRules(det.state, mode, opts.replace, from);
  const reads = await readConfigs(lay);
  const cfg =
    from === "opencode"
      ? planConfigToCc(lay, reads, prev, opts.replace)
      : planConfigToOc(lay, reads, prev, opts.replace);
  const mds = await convertBoth(from, lay, det, root, prev, opts.replace);
  const settings = reads.settings.state === "ok" ? reads.settings.data : undefined;
  const notes = notesFor(det, from, mode, settings, rules.intents);
  return {
    from,
    rulesMode: mode,
    state: det.state,
    intents: rules.intents,
    files: [...cfg.files, ...mds.planned],
    warnings: [...cfg.warnings, ...mds.warnings, ...notes.warnings],
    notes: [...notes.notes, ...mds.notes],
    conflicts: rules.conflict === null ? cfg.conflicts : [rules.conflict, ...cfg.conflicts],
  };
}
