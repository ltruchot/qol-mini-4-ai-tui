import { join } from "node:path";
import { execa } from "execa";
import { put } from "./harmony.ts";
import { tmpDir } from "./tmp.ts";

const CLI = join(import.meta.dirname, "../../src/cli.ts");

export const HANDOFF = "> Session handoff: read `TODO.md` first.\n\n# Rules\n";

const KAIZEN =
  "---\nname: kaizen\ndescription: Reviews the session. Use before compacting.\n---\n# Kaizen\n";

// The gates write to the process's own stdout: run the CLI as a real process
type Ran = { code: number; out: string; err: string };

export async function vitals(args: string[], env: Record<string, string> = {}): Promise<Ran> {
  const run = await execa("node", [CLI, "vitals", ...args], { reject: false, env });
  return { code: run.exitCode ?? -1, out: run.stdout, err: run.stderr };
}

// A repository that passes every probe of both gates, plus `extra` files
export async function healthy(extra: Record<string, string> = {}): Promise<string> {
  const dir = await tmpDir("qol-mini-vitals-");
  await put(dir, {
    "AGENTS.md": HANDOFF,
    "TODO.md": "# TODO\n",
    ".claude/skills/kaizen/SKILL.md": KAIZEN,
    ...extra,
  });
  return dir;
}
