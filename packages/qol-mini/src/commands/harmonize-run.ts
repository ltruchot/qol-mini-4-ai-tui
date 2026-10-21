import type { CAC } from "cac";
import pc from "picocolors";
import { apply } from "../harmonize/apply.ts";
import { jsonOf, report } from "../harmonize/report.ts";
import { plan } from "../harmonize/plan.ts";
import { intro, outro, print, success, warn } from "../io/ui.ts";
import { hContext, optsOf, type HOpts } from "./harmonize-ctx.ts";

// Plan the repo, show every move and file, write when there is something to
// write. A conflict writes nothing and names what a re-run with --replace and
// --from would do.
export async function runHarmonize(project: string | undefined, opts: HOpts): Promise<number> {
  const ctx = await hContext(opts, project);
  const p = await plan(ctx.root, optsOf(opts), ctx.lock.harmonize);
  if (ctx.json) {
    print([JSON.stringify(jsonOf(p))]);
    return p.conflicts.length > 0 ? 1 : 0;
  }
  intro("qol-mini harmonize");
  for (const line of report(p)) print([line]);
  if (p.conflicts.length > 0) {
    for (const conflict of p.conflicts) warn(conflict);
    outro(pc.red("nothing written"));
    return 1;
  }
  if (ctx.dryRun) {
    outro("dry run, nothing written");
    return 0;
  }
  if (p.intents.length === 0 && p.files.length === 0) {
    outro(pc.green("already harmonized, nothing to do"));
    return 0;
  }
  const done = await apply(ctx.root, p, ctx.lock.harmonize);
  for (const warning of done.warnings) warn(warning);
  success(`applied ${p.intents.length} rule move(s), wrote ${p.files.length} file(s)`);
  outro("commit the lock and the generated files");
  return 0;
}

export function register(cli: CAC): void {
  cli.command("run [project]", "Make one repo compatible with both agents").action(runHarmonize);
}
