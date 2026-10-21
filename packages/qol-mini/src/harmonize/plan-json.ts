import { hashBytes } from "../core/hash/file.ts";
import { stableJson } from "../core/lock/sort.ts";
import type { Artifact, ArtifactKind } from "../core/schema/harmony.ts";
import { rel } from "./layout.ts";
import type { Planned } from "./plan-types.ts";

// A shared JSON target (opencode.json, settings.json, .mcp.json): the merge
// decides, not the formatting. Identical content stays untouched whatever the
// key order on disk; a file changed since our last write needs --replace.
export function planJson(
  kind: ArtifactKind,
  file: string,
  root: string,
  merged: Record<string, unknown>,
  current: { data: Record<string, unknown>; text: string } | null,
  sources: Record<string, string>,
  mine: string[],
  prev: Artifact | undefined,
  replace: boolean,
): { planned: Planned | null; outcome: string } {
  const bytes = Buffer.from(stableJson(merged));
  const plan = (): Planned => ({ kind, file, rel: rel({ root }, file), bytes, sources, mine });
  if (current !== null && stableJson(current.data) === stableJson(merged))
    return { planned: null, outcome: "already current" };
  if (current !== null && prev !== undefined && hashBytes(Buffer.from(current.text)) !== prev.hash)
    return replace
      ? { planned: plan(), outcome: "written over local edits" }
      : { planned: null, outcome: "edited since the last run, --replace overwrites" };
  if (current !== null && prev === undefined && !replace)
    return { planned: null, outcome: "present, never written by this kit, --replace overwrites" };
  return { planned: plan(), outcome: "written" };
}
