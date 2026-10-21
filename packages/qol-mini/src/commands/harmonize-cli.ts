import { cac, type CAC } from "cac";
import { register as check } from "./harmonize-check.ts";
import { register as run } from "./harmonize-run.ts";
import { register as scan } from "./harmonize-scan.ts";
import { register as undo } from "./harmonize-undo.ts";
import { runNamespace } from "./namespace.ts";

export const HARMONIZE = "harmonize";
const SUBS = new Set(["check", "undo", "scan"]);

// Project scope, both agents: `qol-mini harmonize <command>`. A first argument
// that is no subcommand is a project path: `qol-mini harmonize /my/repo`.
function harmonizeCli(): CAC {
  const cli = cac(`qol-mini ${HARMONIZE}`);
  cli.option("--cwd <dir>", "Dir to resolve a project from, default cwd");
  cli.option("-y, --yes", "Skip prompts, fail on missing answers");
  cli.option("--json", "Machine output where supported");
  cli.option("--dry-run", "Plan and preview, write nothing");
  cli.option("--replace", "Overwrite a generated file you edited");
  cli.option("--from <side>", "Source of truth: claude, opencode, auto (default)");
  cli.option("--rules <mode>", "pure (default), bridge, symlink");
  for (const register of [run, check, undo, scan]) register(cli);
  cli.help();
  return cli;
}

export function harmonize(argv: string[]): Promise<number> {
  const rest = argv.slice(3);
  const first = rest.find((a) => !a.startsWith("-"));
  if (first === undefined || SUBS.has(first)) return runNamespace(harmonizeCli(), argv);
  return runNamespace(harmonizeCli(), [...argv.slice(0, 3), "run", ...rest]);
}
