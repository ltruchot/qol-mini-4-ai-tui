import type { CAC } from "cac";
import pc from "picocolors";
import { checkHarmony } from "../harmonize/check.ts";
import { STATUS_LABEL, type Status } from "../core/status/buckets.ts";
import { intro, outro, print } from "../io/ui.ts";
import { hContext, type HOpts } from "./harmonize-ctx.ts";

const paint = (s: Status): string =>
  s === "ok" ? pc.green(STATUS_LABEL[s]) : pc.red(STATUS_LABEL[s]);

// Exit 0 ok, 1 a source changed, 2 a file we wrote was edited or went missing
export async function runCheck(project: string | undefined, opts: HOpts): Promise<number> {
  const ctx = await hContext(opts, project);
  if (ctx.lock.harmonize === undefined) {
    if (ctx.json) print([JSON.stringify({ harmonized: false })]);
    else {
      intro("qol-mini harmonize check");
      outro(pc.red("not harmonized: run qol-mini harmonize"));
    }
    return 1;
  }
  const { rows, worst } = await checkHarmony(ctx.root, ctx.lock.harmonize);
  if (ctx.json) {
    print([JSON.stringify({ harmonized: true, rows, exit: worst })]);
    return worst;
  }
  intro("qol-mini harmonize check");
  for (const row of rows) print([`${row.path}: ${paint(row.status)}`]);
  outro(worst === 0 ? pc.green("all good") : pc.red(`exit ${worst}`));
  return worst;
}

export function register(cli: CAC): void {
  cli.command("check [project]", "Report harmonization status, exit code for CI").action(runCheck);
}
