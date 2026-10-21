import type { Artifact } from "../core/schema/harmony.ts";
import { rel, type Layout } from "./layout.ts";
import { planTarget } from "./plan-target.ts";
import type { Json, JsonResult } from "./read.ts";
import type { SliceOut } from "./plan-io.ts";

// One JSON target file (settings.json, .mcp.json): merge into a copy of what
// is there, plan when it moved. Nothing ours to add or remove: no file appears
// where the source has nothing.
export function targetJson(
  out: SliceOut,
  lay: Layout,
  kind: "permission" | "mcp",
  file: string,
  read: JsonResult,
  sources: Record<string, string>,
  prev: Record<string, Artifact>,
  replace: boolean,
  merge: (base: Json, mine: string[]) => { mine: string[]; warnings: string[] },
): void {
  const relPath = rel(lay, file);
  if (read.state === "bad") {
    out.conflicts.push(`${relPath}: unparseable (${read.error})`);
    return;
  }
  const base: Json = read.state === "ok" ? structuredClone(read.data) : {};
  const prevArt = prev[relPath];
  const mine = prevArt?.mine ?? [];
  const merged = merge(base, mine);
  if (merged.mine.length === 0 && mine.length === 0) return;
  planTarget(out, kind, lay, file, read, base, merged, sources, prevArt, replace);
}
