import { join } from "node:path";
import type { Artifact, ArtifactKind } from "../core/schema/harmony.ts";
import { readText } from "./read.ts";
import { convertOne, type Convert, type OneOut } from "./slice-one.ts";

// Convert every `.md` of a source dir through `convert`, guard each target,
// and report what was skipped and why. Same shape for commands and agents.
export async function convertMds(
  kind: ArtifactKind,
  sourceDir: string,
  targetDir: string,
  files: string[],
  root: string,
  prev: Record<string, Artifact>,
  replace: boolean,
  convert: Convert,
): Promise<OneOut> {
  const out: OneOut = { planned: [], warnings: [], notes: [] };
  for (const name of files) {
    const text = await readText(join(sourceDir, name));
    if (text === null) continue;
    const one = await convertOne(
      kind,
      sourceDir,
      targetDir,
      name,
      text,
      root,
      prev,
      replace,
      convert,
    );
    out.planned.push(...one.planned);
    out.warnings.push(...one.warnings);
    out.notes.push(...one.notes);
  }
  return out;
}
