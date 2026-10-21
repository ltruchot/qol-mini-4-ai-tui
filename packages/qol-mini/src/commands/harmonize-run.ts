import type { CAC } from "cac";
import pc from "picocolors";
import { apply } from "../harmonize/apply.ts";
import { idle, jsonOf, report } from "../harmonize/report.ts";
import { plan } from "../harmonize/plan.ts";
import type { Plan } from "../harmonize/plan-types.ts";
import { intro, outro, print, success, warn } from "../io/ui.ts";
import { hContext, type HCtx, type HOpts } from "./harmonize-ctx.ts";
import { optsOf } from "./harmonize-opts.ts";

// Plan the repo, show every move and file, write when there is something to
// write. A conflict writes nothing and names what --replace and --from do.
export async function runHarmonize(project: string | undefined, opts: HOpts): Promise<number> {
  const planOpts = optsOf(opts);
  const ctx = await hContext(opts, project);
  const p = await plan(ctx.root, planOpts, ctx.lock.harmonize);
  if (ctx.json) return runJson(ctx, p);
  intro("qol-mini harmonize");
  for (const line of report(p)) print([line]);
  if (p.conflicts.length > 0) {
    outro(pc.red("nothing written"));
    return 1;
  }
  if (ctx.dryRun) {
    outro("dry run, nothing written");
    return 0;
  }
  if (idle(p)) {
    outro(pc.green("already harmonized, nothing to do"));
    return 0;
  }
  const done = await apply(ctx.root, p, ctx.lock.harmonize);
  for (const warning of done.warnings) warn(warning);
  success(`applied ${p.intents.length} rule move(s), wrote ${p.files.length} file(s)`);
  outro("commit the lock and the generated files");
  return 0;
}

// Machine output: the same run, the plan printed as JSON once it is applied
async function runJson(ctx: HCtx, p: Plan): Promise<number> {
  const written = p.conflicts.length === 0 && !ctx.dryRun && !idle(p);
  const done = written ? await apply(ctx.root, p, ctx.lock.harmonize) : { warnings: [] };
  print([JSON.stringify({ ...jsonOf(p), warnings: [...p.warnings, ...done.warnings], written })]);
  return p.conflicts.length > 0 ? 1 : 0;
}

export function register(cli: CAC): void {
  cli.command("run [project]", "Make one repo compatible with both agents").action(runHarmonize);
}
