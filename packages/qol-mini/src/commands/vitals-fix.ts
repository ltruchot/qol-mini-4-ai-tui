import { CANCELLED, isKitError } from "../core/errors.ts";
import { print, printErr } from "../io/ui.ts";
import { harmonize } from "./harmonize-cli.ts";
import { skills } from "./skills-cli.ts";

// The namespaces a finding's command may name. Anything else is refused: a
// gate proposes, and only these two write.
const RUNNERS = new Map(Object.entries({ harmonize, skills }));

// A word the platform's shell reads as one argument: a Windows path keeps its
// backslashes, and PowerShell and cmd both take double quotes
const WINDOWS = process.platform === "win32";
const SAFE = WINDOWS ? /^[\w@%+=:,./\\~-]+$/u : /^[\w@%+=:,./~-]+$/u;
const quoted = (word: string): string => {
  if (SAFE.test(word)) return word;
  return WINDOWS ? `"${word}"` : `'${word.replaceAll("'", String.raw`'\''`)}'`;
};

async function runOne(command: string[], repo: string): Promise<boolean> {
  const runner = RUNNERS.get(command[0] ?? "");
  if (runner === undefined) {
    printErr(`error: a finding names an unknown command: ${command.join(" ")}`);
    return false;
  }
  try {
    return (await runner([...process.argv.slice(0, 2), ...command, repo])) === 0;
  } catch (error) {
    if (!isKitError(error) || error.code === CANCELLED) throw error;
    printErr(`error: ${error.message}`);
    return false;
  }
}

// Each command the findings name, on the repository. A dry run only names
// them. The result says whether every command succeeded; a cancelled prompt
// stops the run.
export async function runFix(
  commands: string[][],
  repo: string,
  dryRun: boolean,
): Promise<boolean> {
  if (commands.length === 0) print(["no finding names a command: nothing to run"]);
  let ok = true;
  for (const command of commands) {
    print([`run: qol-mini ${[...command, repo].map(quoted).join(" ")}`]);
    if (!dryRun) ok = (await runOne(command, repo)) && ok;
  }
  return ok;
}
