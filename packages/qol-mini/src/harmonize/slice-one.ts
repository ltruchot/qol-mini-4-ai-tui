import { join } from "node:path";
import { hashBytes } from "../core/hash/file.ts";
import { split, withFrontmatter } from "../core/harmonize/fm.ts";
import type { Artifact, ArtifactKind } from "../core/schema/harmony.ts";
import { readText } from "./read.ts";
import { rel } from "./layout.ts";
import { guardFile, guardNotes } from "./guard.ts";
import { plannedFile } from "./planned-file.ts";
import type { Planned } from "./plan-types.ts";

export type Convert = (
  data: Record<string, unknown>,
  stem: string,
) => { data: Record<string, unknown>; lossy: string[] } | null;
export type OneOut = { planned: Planned[]; warnings: string[]; notes: string[] };

// One markdown file through `convert`, the target guarded, losses named
export async function convertOne(
  kind: ArtifactKind,
  sourceDir: string,
  targetDir: string,
  name: string,
  text: string,
  root: string,
  prev: Record<string, Artifact>,
  replace: boolean,
  convert: Convert,
): Promise<OneOut> {
  const { data, body } = split(text);
  const md = convert(data, name.replace(/\.md$/, ""));
  const source = rel({ root }, join(sourceDir, name));
  if (md === null) return { planned: [], warnings: [`${source}: disabled, skipped`], notes: [] };
  const bytes = Buffer.from(withFrontmatter(md.data, body));
  const file = join(targetDir, name);
  const relPath = rel({ root }, file);
  const current = await readText(file);
  const guard = guardFile(
    current === null ? null : Buffer.from(current),
    bytes,
    prev[relPath],
    replace,
  );
  const planned =
    guard === "create" || guard === "refresh"
      ? [plannedFile(kind, root, file, bytes, source, hashBytes(Buffer.from(text)))]
      : [];
  const said = guardNotes(relPath, guard);
  const lossy = md.lossy.map((loss): string => `${relPath}: ${loss}`);
  return { planned, warnings: [...lossy, ...said.warnings], notes: said.notes };
}
