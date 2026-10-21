import { isKitError } from "./core/errors.ts";
import { fail, print, printErr } from "./io/ui.ts";
import { runKit } from "./kit/index.ts";
import { VERSION } from "./version.ts";
import { harmonize, HARMONIZE } from "./commands/harmonize-cli.ts";
import { skills, SKILLS } from "./commands/skills-cli.ts";

async function dispatch(argv: string[]): Promise<number> {
  if (argv[2] === SKILLS) return skills(argv);
  if (argv[2] === HARMONIZE) return harmonize(argv);
  if (argv[2] === "--version" || argv[2] === "-v") {
    print([VERSION]);
    return 0;
  }
  return (await runKit(argv.slice(2))) ?? fail(`unknown command: ${argv[2]}, see qol-mini --help`);
}

// Run the command, map errors to exit codes
export async function main(argv: string[]): Promise<number> {
  try {
    return await dispatch(argv);
  } catch (error) {
    printErr(`error: ${(error as Error).message}`);
    return isKitError(error) ? error.code : 1;
  }
}
