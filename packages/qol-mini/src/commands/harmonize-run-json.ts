import { apply } from "../harmonize/apply.ts";
import { ignoredBy, kept } from "../harmonize/gitignored.ts";
import { idle, jsonOf } from "../harmonize/report.ts";
import type { Plan } from "../harmonize/plan-types.ts";
import { print } from "../io/ui.ts";
import type { HCtx } from "./harmonize-ctx.ts";

// Machine output: the same run, the plan printed as JSON once it is applied
export async function runJson(ctx: HCtx, p: Plan): Promise<number> {
  const written = p.conflicts.length === 0 && !ctx.dryRun && !idle(p);
  const done = written ? await apply(ctx.root, p, ctx.lock.harmonize) : { warnings: [] };
  const earlier = Object.keys(ctx.lock.harmonize?.artifacts ?? {});
  const ignored = ignoredBy(ctx.root, kept(p, earlier));
  const warnings = [...p.warnings, ...done.warnings, ...ignored];
  print([JSON.stringify({ ...jsonOf(p), warnings, written })]);
  return p.conflicts.length > 0 ? 1 : 0;
}
