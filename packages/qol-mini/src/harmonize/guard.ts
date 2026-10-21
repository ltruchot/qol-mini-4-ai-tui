import { hashBytes } from "../core/hash/file.ts";
import type { Artifact } from "../core/schema/harmony.ts";

// May the harmonizer write this generated file? An identical file stays
// untouched; a file it owns regenerates unless the user edited it; a file it
// never wrote yields to --replace. Names the reason either way.
export type Guard = "create" | "refresh" | "noop" | "edited" | "foreign";

export function guardFile(
  current: Buffer | null,
  planned: Buffer,
  prev: Artifact | undefined,
  replace: boolean,
): Guard {
  if (current === null) return "create";
  if (Buffer.compare(current, planned) === 0) return "noop";
  if (prev === undefined) return replace ? "refresh" : "foreign";
  if (hashBytes(current) === prev.hash) return "refresh";
  return replace ? "refresh" : "edited";
}

export const GUARD_NOTE: Record<Guard, string | null> = {
  create: null,
  refresh: null,
  noop: "already current",
  edited: "edited since the last run: --replace overwrites",
  foreign: "present, never written by this kit: --replace overwrites",
};

// What the guard verdict reports about one file, split by audience
export function guardNotes(relPath: string, guard: Guard): { warnings: string[]; notes: string[] } {
  const note = GUARD_NOTE[guard];
  if (note === null) return { warnings: [], notes: [] };
  const line = `${relPath}: ${note}`;
  return guard === "noop" ? { warnings: [], notes: [line] } : { warnings: [line], notes: [] };
}
