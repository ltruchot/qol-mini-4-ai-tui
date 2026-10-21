import type { Artifact } from "../core/schema/harmony.ts";
import { rel, type Layout } from "./layout.ts";
import { planJson } from "./plan-json.ts";
import type { SliceOut } from "./plan-io.ts";
import type { JsonResult } from "./read.ts";

// One shared JSON target (opencode.json, settings.json, .mcp.json): the merge
// decides, not the formatting. Identical content stays untouched whatever the
// key order on disk; a file changed since our last write needs --replace.
export function planTarget(
  out: SliceOut,
  kind: "permission" | "mcp",
  lay: Layout,
  file: string,
  read: JsonResult,
  base: Record<string, unknown>,
  merged: { mine: string[]; warnings: string[] },
  sources: Record<string, string>,
  prevArt: Artifact | undefined,
  replace: boolean,
): void {
  const relPath = rel(lay, file);
  out.warnings.push(...merged.warnings);
  if (read.state === "bad") {
    out.conflicts.push(`${relPath}: unparseable (${read.error})`);
    return;
  }
  const plan = planJson(
    kind,
    file,
    lay.root,
    base,
    read.state === "ok" ? { data: read.data, text: read.text } : null,
    sources,
    merged.mine,
    prevArt,
    replace,
  );
  if (plan.planned !== null) out.files.push(plan.planned);
  else if (plan.outcome !== "already current") out.warnings.push(`${relPath}: ${plan.outcome}`);
}
