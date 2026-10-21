import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "../io/fs.ts";
import { scanHit, type ScanHit } from "./scan-hit.ts";

const MAX_DEPTH = 6;

// Walk one root, one level of directory per repo: a dir holding .git is
// scanned and not descended into. Hidden dirs and node_modules are skipped.
export async function walk(
  dir: string,
  depth: number,
  hits: ScanHit[],
  errors: string[],
): Promise<void> {
  let entries;
  try {
    if (!(await exists(dir))) throw new Error("not a directory");
    if (await exists(join(dir, ".git"))) {
      const found = await scanHit(dir);
      if (found !== null) hits.push(found);
      return;
    }
    if (depth >= MAX_DEPTH) return;
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    errors.push(`${dir}: ${(error as Error).message}`);
    return;
  }
  for (const entry of entries)
    if (entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith("."))
      await walk(join(dir, entry.name), depth + 1, hits, errors);
}
