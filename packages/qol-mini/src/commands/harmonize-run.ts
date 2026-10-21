import type { CAC } from "cac";
import pc from "picocolors";
import { apply } from "../harmonize/apply.ts";
import { ignoredBy, kept } from "../harmonize/gitignored.ts";
import { idle, report } from "../harmonize/report.ts";
import { plan } from "../harmonize/plan.ts";
import { intro, outro, print, success, warn } from "../io/ui.ts";
import { hContext, type HOpts } from "./harmonize-ctx.ts";
import { runJson } from "./harmonize-run-json.ts";
import { optsOf } from "./harmonize-opts.ts";

// Plan the repo, show every move and file, write when there is something to
// write. A conflict writes nothing and names what --replace and --from do.
// Every other outcome ends naming the kept files git would leave out.
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
  const earlier = Object.keys(ctx.lock.harmonize?.artifacts ?? {});
  const ignored = (): void => {
    for (const line of ignoredBy(ctx.root, kept(p, earlier))) warn(line);
  };
  if (ctx.dryRun) {
    ignored();
    outro("dry run, nothing written");
    return 0;
  }
  if (idle(p)) {
    ignored();
    outro(pc.green("already harmonized, nothing to do"));
    return 0;
  }
  const done = await apply(ctx.root, p, ctx.lock.harmonize);
  for (const warning of done.warnings) warn(warning);
  success(`applied ${p.intents.length} rule move(s), wrote ${p.files.length} file(s)`);
  ignored();
  outro("commit the lock and the generated files");
  return 0;
}

export function register(cli: CAC): void {
  cli.command("run [project]", "Make one repo compatible with both agents").action(runHarmonize);
}
