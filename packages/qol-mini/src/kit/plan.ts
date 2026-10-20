import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { SOUNDS, SUPERSEDED } from "./files.ts";
import type { Chosen } from "./options.ts";
import type { Settings } from "./state.ts";

export type Diff = { create: string[]; clash: string[]; same: string[] };

export type Plan = Diff & { sounds: string[]; stale: string[]; settings: boolean };

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
  return {
    create,
    clash,
    same: names.filter((r) => !create.includes(r) && !clash.includes(r)),
  };
}

// Nothing is written before the plan is settled: a refusing run writes nothing.
export function plan(
  chosen: Chosen,
  target: string,
  wanted: Map<string, Buffer>,
  changed: boolean,
): Plan {
  return {
    ...diff(target, wanted),
    sounds: chosen.sounds ? SOUNDS.filter((n) => !existsSync(join(target, "sounds", n))) : [],
    stale: SUPERSEDED.filter((r) => existsSync(join(target, r))),
    settings: changed,
  };
}

export const idle = (p: Plan): boolean =>
  [p.create, p.clash, p.sounds, p.stale].every((l) => l.length === 0) && !p.settings;
