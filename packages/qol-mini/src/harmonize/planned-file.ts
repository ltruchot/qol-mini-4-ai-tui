import type { ArtifactKind } from "../core/schema/harmony.ts";
import { rel } from "./layout.ts";
import type { Planned } from "./plan-types.ts";

// One converted markdown file, its source pinned by hash
export function plannedFile(
  kind: ArtifactKind,
  root: string,
  file: string,
  bytes: Buffer,
  source: string,
  sourceHash: string,
): Planned {
  return {
    kind,
    file,
    rel: rel({ root }, file),
    bytes,
    sources: { [source]: sourceHash },
    mine: [],
  };
}
