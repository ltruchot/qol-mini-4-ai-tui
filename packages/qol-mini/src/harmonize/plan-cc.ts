import type { Artifact } from "../core/schema/harmony.ts";
import { rel, type Layout } from "./layout.ts";
import { permToOc } from "./slice-perm.ts";
import { mcpToOc } from "./slice-mcp.ts";
import type { Json } from "./read.ts";
import type { Reads, SliceOut } from "./plan-io.ts";
import { absorb, type Acc } from "./plan-absorb.ts";
import { planTarget } from "./plan-target.ts";

// Claude Code -> OpenCode: permissions and MCP servers land in one merged
// opencode.json, a file the run owns or adopts under --replace.
export function planConfigToOc(
  lay: Layout,
  reads: Reads,
  prev: Record<string, Artifact>,
  replace: boolean,
): SliceOut {
  const out: SliceOut = { files: [], warnings: [], conflicts: [] };
  const ocRel = rel(lay, lay.ocConfig);
  const prevArt = prev[ocRel];
  const base: Json = reads.ocConfig.state === "ok" ? structuredClone(reads.ocConfig.data) : {};
  if (reads.ocConfig.state === "bad")
    out.conflicts.push(`${ocRel}: unparseable (${reads.ocConfig.error})`);
  const acc: Acc = { sources: {}, mine: [] };
  const mine = prevArt?.mine ?? [];
  absorb(out, acc, reads.settings, rel(lay, lay.settings), base, mine, permToOc);
  absorb(out, acc, reads.mcpJson, rel(lay, lay.mcpJson), base, mine, mcpToOc);
  // Nothing ours to add or remove: no file appears where the source has nothing
  if (acc.mine.length === 0 && mine.length === 0) return out;
  const kind: "permission" | "mcp" = acc.mine.some((m) => m.startsWith("mcp:"))
    ? "mcp"
    : "permission";
  planTarget(
    out,
    kind,
    lay,
    lay.ocConfig,
    reads.ocConfig,
    base,
    { mine: acc.mine, warnings: [] },
    acc.sources,
    prevArt,
    replace,
  );
  return out;
}
