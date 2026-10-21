import type { Json, JsonResult } from "./read.ts";
import type { SliceOut } from "./plan-io.ts";

export type Acc = { sources: Record<string, string>; mine: string[] };
type Into = (data: Json, base: Json, mine: string[]) => { mine: string[]; warnings: string[] };

// Convert one source file into a shared base when it parses: unparseable
// files are named as conflicts, absent files skipped without a word.
export function absorb(
  out: SliceOut,
  acc: Acc,
  read: JsonResult,
  name: string,
  base: Json,
  mine: string[],
  convert: Into,
): void {
  if (read.state !== "ok") {
    if (read.state === "bad") out.conflicts.push(`${name}: unparseable (${read.error})`);
    return;
  }
  const merged = convert(read.data, base, mine);
  acc.sources[name] = read.hash;
  acc.mine.push(...merged.mine);
  out.warnings.push(...merged.warnings);
}
