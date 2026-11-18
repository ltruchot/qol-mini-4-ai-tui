import { homedir } from "node:os";
import { resolve } from "node:path";
import type { CAC } from "cac";
import { fail } from "../io/ui.ts";
import { gateModule, GATES, isGate } from "../vitals/gates.ts";
import { guestView } from "../vitals/guest.ts";
import { runGate } from "../vitals/wasi.ts";

type Opts = { repoOnly?: boolean };

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
export async function runVitals(args: string[], opts: Opts): Promise<number> {
  const { gates, repo } = parse(args);
  const view = guestView(repo, homedir());
  const flags = opts.repoOnly === true ? ["--repo-only"] : [];
  let worst = 0;
  for (const gate of gates) worst = Math.max(worst, await runGate(gateModule(gate), flags, view));
  return worst;
}

export function register(cli: CAC): void {
  cli
    .command("[...args]", `Audit a repository for coding agents: [${GATES.join("|")}] [path]`)
    .option("--repo-only", "Skip the user scope: parent directories and the home directory")
    .action(runVitals);
}
