import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheRoot } from "../io/cache.ts";
import { exists } from "../io/fs.ts";

// One backup store per project, outside the repo: slots hold the bytes each
// written file had before a run, numbered the way the lock references them.
export function storeDir(root: string): string {
  const id = createHash("sha256").update(root).digest("hex").slice(0, 16);
  return join(cacheRoot(), "harmony", id);
}

async function slotPath(root: string, slot: number): Promise<string> {
  const dir = join(storeDir(root), String(slot));
  await mkdir(dir, { recursive: true });
  return join(dir, "bytes");
}

// Save the current bytes, true when the file existed
export async function saveSlot(root: string, slot: number, file: string): Promise<boolean> {
  if (!(await exists(file))) return false;
  await writeFile(await slotPath(root, slot), await readFile(file));
  return true;
}

export function loadSlot(root: string, slot: number): Promise<Buffer> {
  return readFile(join(storeDir(root), String(slot), "bytes"));
}

export async function clearStore(root: string): Promise<void> {
  await rm(storeDir(root), { recursive: true, force: true });
}
