import type { CAC } from "cac";

// Run a subcommand namespace: `qol-mini <name> <command>`. The binary keeps
// argv[1] as its default command name, the namespace word at argv[2] goes.
export async function runNamespace(cli: CAC, argv: string[]): Promise<number> {
  cli.parse([...argv.slice(0, 2), ...argv.slice(3)], { run: false });
  if (cli.matchedCommand === undefined && cli.options["help"] !== true) cli.outputHelp();
  const result: unknown = await cli.runMatchedCommand();
  return typeof result === "number" ? result : 0;
}
