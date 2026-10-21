import { join } from "node:path";
import { exists } from "../io/fs.ts";

// A repo may keep its OpenCode config at the root or under `.opencode/`, its
// commands in `command/` or `commands/`. What exists wins; new files take the
// documented location: root `opencode.json`, plural `commands`.
export async function existing(...files: string[]): Promise<string | undefined> {
  for (const file of files) if (await exists(file)) return file;
  return undefined;
}

export async function configAt(root: string): Promise<string> {
  const ocDir = join(root, ".opencode");
  const found = await existing(join(root, "opencode.json"), join(ocDir, "opencode.json"));
  return found ?? join(root, "opencode.json");
}

export async function dirAt(root: string, plural: string): Promise<string> {
  const ocDir = join(root, ".opencode");
  const found = await existing(join(ocDir, plural), join(ocDir, plural.slice(0, -1)));
  return found ?? join(ocDir, plural);
}
