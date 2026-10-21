import { exists } from "../io/fs.ts";
import { lstat, readdir, readlink, readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { FileKind } from "../core/harmonize/rules.ts";

// Small fs questions the detector asks. A broken symlink is a symlink:
// lstat never follows, so a dangling CLAUDE.md still reads as one.
export async function kind(file: string): Promise<FileKind> {
  try {
    return (await lstat(file)).isSymbolicLink() ? "symlink" : "file";
  } catch {
    return "absent";
  }
}

// A symlink's target as a basename, the way rules.ts compares it
export async function target(file: string): Promise<string | undefined> {
  try {
    return basename(await readlink(file));
  } catch {
    return undefined;
  }
}

export async function mds(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  return (await readdir(dir)).filter((n) => n.endsWith(".md")).toSorted();
}

export async function dirs(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  return (await readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .toSorted();
}

// Hook event names from a settings file, empty on a parse error
export async function hookEvents(file: string): Promise<string[]> {
  if (!(await exists(file))) return [];
  try {
    const hooks =
      (JSON.parse(await readFile(file, "utf8")) as { hooks?: Record<string, unknown> }).hooks ?? {};
    return Object.keys(hooks);
  } catch {
    return [];
  }
}
