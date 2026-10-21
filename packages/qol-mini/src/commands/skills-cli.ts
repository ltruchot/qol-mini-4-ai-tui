import { cac, type CAC } from "cac";
import { registerAll } from "./index.ts";
import { runNamespace } from "./namespace.ts";

export const SKILLS = "skills";

// Project scope: `qol-mini skills <command>`
function skillsCli(): CAC {
  const cli = cac(`qol-mini ${SKILLS}`);
  cli.option("--cwd <dir>", "Dir to resolve a project from, default cwd");
  cli.option("-y, --yes", "Skip prompts, fail on missing answers");
  cli.option("--json", "Machine output where supported");
  cli.option("--dry-run", "Plan and preview, write nothing");
  registerAll(cli);
  cli.help();
  return cli;
}

export function skills(argv: string[]): Promise<number> {
  return runNamespace(skillsCli(), argv);
}
