import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Settings } from "./state.ts";

export type Diff = { create: string[]; clash: string[]; same: string[] };

// Python dicts compare without key order, and so does this
export const sameSettings = (a: Settings, b: Settings): boolean => isDeepStrictEqual(a, b);

// What differs between the target and the wanted files: created, differing,
// identical. Shared by every target the installer writes to.
export function diff(target: string, wanted: Map<string, Buffer>): Diff {
  const names = [...wanted.keys()].toSorted();
  const differs = (r: string): boolean =>
    !readFileSync(join(target, r)).equals(wanted.get(r) ?? Buffer.alloc(0));
  const create = names.filter((r) => !existsSync(join(target, r)));
  const clash = names.filter((r) => !create.includes(r) && differs(r));
  return { create, clash, same: names.filter((r) => !create.includes(r) && !clash.includes(r)) };
}
