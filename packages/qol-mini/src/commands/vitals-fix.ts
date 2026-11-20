import { isKitError } from "../core/errors.ts";
import { fail, print, printErr } from "../io/ui.ts";
import { harmonize } from "./harmonize-cli.ts";
import { skills } from "./skills-cli.ts";

// The namespaces a finding's command may name. Anything else is refused: a
// gate proposes, and only these two write.
const RUNNERS: Record<string, (argv: string[]) => Promise<number>> = { harmonize, skills };

async function runOne(command: string[], repo: string): Promise<boolean> {
  const [name = ""] = command;
  const runner = RUNNERS[name] ?? fail(`a finding names an unknown command: ${command.join(" ")}`);
  try {
    return (await runner([...process.argv.slice(0, 2), ...command, repo])) === 0;
  } catch (error) {
    if (!isKitError(error)) throw error;
    printErr(`error: ${error.message}`);
    return false;
  }
}

// Each command the findings name, on the repository. A dry run only names
// them. The result says whether every command succeeded.
export async function runFix(
  commands: string[][],
  repo: string,
  dryRun: boolean,
): Promise<boolean> {
  if (commands.length === 0) print(["no finding names a command: nothing to run"]);
  let ok = true;
  for (const command of commands) {
    print([`run: qol-mini ${command.join(" ")} ${repo}`]);
    if (!dryRun) ok = (await runOne(command, repo)) && ok;
  }
  return ok;
}
