import { cac } from "cac";
import { GATES } from "../vitals/gates.ts";
import { runNamespace } from "./namespace.ts";
import { runVitals } from "./vitals-run.ts";

export const VITALS = "vitals";

// Repository audit: `qol-mini vitals [gate] [path]`. The gates are read-only:
// exit 0 when no repository probe fails, 1 when one does, 2 when unreadable.
// Only --fix writes, through the commands the findings name.
export function vitals(argv: string[]): Promise<number> {
  const cli = cac(`qol-mini ${VITALS}`);
  cli
    .command("[...args]", `Audit a repository for coding agents: [${GATES.join("|")}] [path]`)
    .option("--repo-only", "Skip the user scope: parent directories and the home directory")
    .option("--json", "Print the reports as a JSON array, one object per gate")
    .option("--fix", "Run the qol-mini commands the findings name, then audit again")
    .option("--dry-run", "With --fix: name the commands, run none")
    .action(runVitals);
  cli.help();
  return runNamespace(cli, argv);
}
