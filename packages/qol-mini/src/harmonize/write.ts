import { mkdir, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Temp file then rename: a reader sees the whole file or the previous one
export async function put(file: string, bytes: Buffer, mode = 0o644): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, bytes, { mode });
    await rename(tmp, file);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

// Remove a file, then the directories it leaves empty up to `root`
export async function prune(file: string, root: string): Promise<void> {
  await rm(file, { force: true });
  let dir = dirname(file);
  for (;;) {
    if (dir === root) return;
    const left = await readdir(dir);
    if (left.length > 0) return;
    await rm(dir, { recursive: true, force: true });
    dir = dirname(dir);
  }
}

// Symlink through the same contract: refused on Windows without Developer
// Mode, the caller falls back to the @AGENTS.md bridge
export function link(target: string, file: string): Promise<void> {
  return symlink(target, file);
}

export const rootJoin = (root: string, rel: string): string => join(root, rel);
