import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { exists } from "../io/fs.ts";

// Claude Code reads AGENTS.md only when no CLAUDE.md, .claude/CLAUDE.md or
// CLAUDE.local.md sits in the working directory or above it. A repo migrated
// to pure AGENTS.md with such a file nearby falls back silently: name them.
const NAMES = ["CLAUDE.md", "CLAUDE.local.md"];

export async function ruleGotchas(root: string): Promise<string[]> {
  const found: string[] = [];
  let dir = dirname(root);
  const stop = root.startsWith(homedir()) ? homedir() : dirname(dir);
  for (;;) {
    // The home directory's own files stay out: `~/.claude/CLAUDE.md` is the
    // global instructions file and loads alongside AGENTS.md, it never hides it
    if (dir === stop || dirname(dir) === dir) break;
    for (const name of NAMES) {
      if (await exists(join(dir, name))) found.push(join(dir, name));
    }
    if (await exists(join(dir, ".claude", "CLAUDE.md")))
      found.push(join(dir, ".claude", "CLAUDE.md"));
    dir = dirname(dir);
  }
  if (await exists(join(root, "CLAUDE.local.md"))) found.push(join(root, "CLAUDE.local.md"));
  return found;
}
