import type { Artifact } from "../core/schema/harmony.ts";
import { rel, type Layout } from "./layout.ts";
import { permToCc } from "./slice-perm.ts";
import { mcpToCc } from "./slice-mcp.ts";
import type { Reads, SliceOut } from "./plan-io.ts";
import { targetJson } from "./plan-helpers.ts";

// OpenCode -> Claude Code: the config's `permission` array becomes
// settings.json allow/deny/ask rules, its `mcp` block becomes .mcp.json.
export function planConfigToCc(
  lay: Layout,
  reads: Reads,
  prev: Record<string, Artifact>,
  replace: boolean,
): SliceOut {
  const out: SliceOut = { files: [], warnings: [], conflicts: [] };
  if (reads.ocConfig.state !== "ok") {
    if (reads.ocConfig.state === "bad")
      out.conflicts.push(`${rel(lay, lay.ocConfig)}: unparseable (${reads.ocConfig.error})`);
    return out;
  }
  const oc = reads.ocConfig;
  const sources = { [rel(lay, lay.ocConfig)]: oc.hash };
  targetJson(
    out,
    lay,
    "permission",
    lay.settings,
    reads.settings,
    sources,
    prev,
    replace,
    (base, mine) => permToCc(oc.data, base, mine),
  );
  targetJson(out, lay, "mcp", lay.mcpJson, reads.mcpJson, sources, prev, replace, (base, mine) =>
    mcpToCc(oc.data, base, mine),
  );
  return out;
}
