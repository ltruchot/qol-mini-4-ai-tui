import { homedir } from "node:os";
import { resolve } from "node:path";
import { fail, print } from "../io/ui.ts";
import { gateModule, GATES, isGate } from "../vitals/gates.ts";
import { guestView } from "../vitals/guest.ts";
import { captureAll, commands, decode, type Target } from "../vitals/report.ts";
import { runGate } from "../vitals/wasi.ts";
import { runFix } from "./vitals-fix.ts";

type Opts = { repoOnly?: boolean; json?: boolean; fix?: boolean; dryRun?: boolean };

// `vitals [gate] [path]`: a first word naming a gate picks it, anything else
// is the repository. `./skills` is the directory, `skills` the gate.
function parse(args: string[]): { gates: string[]; repo: string } {
  const [first = ""] = args;
  const picked = isGate(first);
  const rest = picked ? args.slice(1) : args;
  if (rest.length > 1) fail(`one repository at a time, got: ${rest.join(" ")}`);
  return { gates: picked ? [first] : GATES, repo: resolve(rest[0] ?? ".") };
}

// Every gate runs, in order; the exit status is the worst one
async function text({ gates, flags, view }: Target): Promise<number> {
  let worst = 0;
  for (const gate of gates)
    worst = Math.max(worst, await runGate(gateModule(gate), { flags, view }));
  return worst;
}

// --json prints the reports; --fix runs the commands they name, then audits again
export async function runVitals(args: string[], opts: Opts): Promise<number> {
  if (opts.dryRun === true && opts.fix !== true) fail("--dry-run goes with --fix");
  if (opts.json === true && opts.fix === true) fail("--json and --fix do not combine");
  const { gates, repo } = parse(args);
  const flags = opts.repoOnly === true ? ["--repo-only"] : [];
  const target = { gates, flags, view: guestView(repo, homedir()) };
  if (opts.fix !== true && opts.json !== true) return text(target);
  const { worst, reports } = await captureAll(target);
  if (opts.fix !== true) {
    print([`[${reports.join(",")}]`]);
    return worst;
  }
  const ok = await runFix(commands(reports.map(decode)), repo, opts.dryRun === true);
  return Math.max(await text(target), ok ? 0 : 1);
}
