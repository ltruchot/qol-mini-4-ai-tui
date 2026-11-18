import { cac } from "cac";
import { runNamespace } from "./namespace.ts";
import { register } from "./vitals-run.ts";

export const VITALS = "vitals";

// Repository audit: `qol-mini vitals [gate] [path]`. The gates are read-only:
// exit 0 when no repository probe fails, 1 when one does, 2 when unreadable.
export function vitals(argv: string[]): Promise<number> {
  const cli = cac(`qol-mini ${VITALS}`);
  register(cli);
  cli.help();
  return runNamespace(cli, argv);
}
