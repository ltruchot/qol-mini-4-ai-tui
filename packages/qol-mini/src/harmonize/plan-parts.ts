import type { Artifact, Side } from "../core/schema/harmony.ts";
import type { Detect } from "./detect.ts";
import type { Layout } from "./layout.ts";
import { convertBoth, type MdsOut } from "./plan-mds.ts";
import { planConfigToCc } from "./plan-oc.ts";
import { planConfigToOc } from "./plan-cc.ts";
import type { Reads, SliceOut } from "./plan-io.ts";
import type { On } from "./plan-only.ts";

export type Ctx = {
  from: Side;
  lay: Layout;
  det: Detect;
  prev: Record<string, Artifact>;
  replace: boolean;
  on: On;
};

// Permissions and MCP servers, skipped when `--only` selects neither
export function configs(c: Ctx, reads: Reads): SliceOut {
  if (!c.on("perm") && !c.on("mcp")) return { files: [], warnings: [], conflicts: [] };
  return c.from === "opencode"
    ? planConfigToCc(c.lay, reads, c.prev, c.replace)
    : planConfigToOc(c.lay, reads, c.prev, c.replace);
}

// Commands and agents, skipped when `--only` selects neither
export function markdowns(c: Ctx): Promise<MdsOut> {
  if (!c.on("commands") && !c.on("agents"))
    return Promise.resolve({ planned: [], warnings: [], notes: [] });
  return convertBoth(c.from, c.lay, c.det, c.lay.root, c.prev, c.replace);
}
