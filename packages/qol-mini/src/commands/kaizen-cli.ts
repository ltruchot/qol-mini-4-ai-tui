import { cac } from "cac";
import { print } from "../io/ui.ts";
import { release, RELEASED } from "../kit/hooks/kaizen-token.ts";
import { runNamespace } from "./namespace.ts";

export const KAIZEN_CMD = "kaizen";

// `qol-mini kaizen release`: the token the delivered hook's --release writes,
// for the current directory. A project copy of the kaizen skill runs it, so
// no machine path lands in a committed file.
export function kaizen(argv: string[]): Promise<number> {
  const cli = cac(`qol-mini ${KAIZEN_CMD}`);
  cli
    .command("release", "Release /compact for the current directory, once /kaizen has run")
    .action(() => {
      print([RELEASED, release(process.cwd())]);
      return 0;
    });
  cli.help();
  return runNamespace(cli, argv);
}
