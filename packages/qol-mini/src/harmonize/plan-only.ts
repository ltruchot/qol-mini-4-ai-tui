import type { ArtifactKind, Harmony, Side } from "../core/schema/harmony.ts";
import type { Detect } from "./detect.ts";
import type { PlanOpts, Planned, Slice } from "./plan-types.ts";

const SLICE_OF: Record<ArtifactKind, Slice> = {
  permission: "perm",
  mcp: "mcp",
  command: "commands",
  agent: "agents",
};

export type On = (slice: Slice) => boolean;

export const selector =
  (only: Slice[] | undefined): On =>
  (slice) =>
    only === undefined || only.includes(slice);

// The first run decides the source of truth; a re-run keeps it. A direction
// flip would convert our own output back. `auto` detects again.
export function sideOf(opts: PlanOpts, harmony: Harmony | undefined, det: Detect): Side {
  if (opts.from === "claude" || opts.from === "opencode") return opts.from;
  if (opts.from === "auto") return det.markers.from;
  return harmony?.from ?? det.markers.from;
}

// opencode.json holds permissions and MCP servers in one merge: with one of
// the two selected, it is written whole, and the plan says so.
export function keepFiles(files: Planned[], on: On, shared: string): Planned[] {
  return files.filter((f) => f.file === shared || on(SLICE_OF[f.kind]));
}

export function sharedWarning(on: On, from: Side): string[] {
  if (from === "opencode" || on("perm") === on("mcp")) return [];
  return ["--only: permissions and MCP servers share opencode.json, both are written"];
}
