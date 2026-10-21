import { hashBytes } from "../core/hash/file.ts";
import { stableJson } from "../core/lock/sort.ts";
import type { Artifact, ArtifactKind } from "../core/schema/harmony.ts";
import { freshJson } from "../io/jsonc.ts";
import { patchJsonc } from "../io/jsonc-patch.ts";
import { rel } from "./layout.ts";
import type { Planned } from "./plan-types.ts";

// A shared JSON target (opencode.json, settings.json, .mcp.json): the merge
// decides, not the formatting. An existing file is patched in place, only the
// keys the kit owns move: key order, comments and indent survive, so a file
// the user wrote takes the merge with no --replace. Identical content stays
// untouched; a file changed since our last write needs --replace.
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
  const text =
    current === null ? freshJson(merged) : patchJsonc(current.text, current.data, merged);
  const bytes = Buffer.from(text);
  const plan = (): Planned => ({ kind, file, rel: rel({ root }, file), bytes, sources, mine });
  if (current !== null && stableJson(current.data) === stableJson(merged))
    return { planned: null, outcome: "already current" };
  if (current !== null && prev !== undefined && hashBytes(Buffer.from(current.text)) !== prev.hash)
    return replace
      ? { planned: plan(), outcome: "written over local edits" }
      : { planned: null, outcome: "edited since the last run, --replace overwrites" };
  return { planned: plan(), outcome: "written" };
}
