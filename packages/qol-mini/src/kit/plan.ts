import { existsSync } from "node:fs";
import { join } from "node:path";
import { type Diff, diff } from "./diff.ts";
import { SOUNDS, SUPERSEDED } from "./files.ts";
import { delivered } from "./node-path.ts";
import type { Chosen } from "./options.ts";

// `refresh`: differing only by the node path, rewritten without --replace
export type Plan = Diff & {
  refresh: string[];
  sounds: string[];
  stale: string[];
  settings: boolean;
};

// Nothing is written before the plan is settled: a refusing run writes nothing.
export function plan(
  chosen: Chosen,
  target: string,
  wanted: Map<string, Buffer>,
  changed: boolean,
  node: string,
): Plan {
  const d = diff(target, wanted);
  const refresh = d.clash.filter((r) => delivered(join(target, r), wanted.get(r), node));
  return {
    ...d,
    clash: d.clash.filter((r) => !refresh.includes(r)),
    refresh,
    sounds: chosen.sounds ? SOUNDS.filter((n) => !existsSync(join(target, "sounds", n))) : [],
    stale: SUPERSEDED.filter((r) => existsSync(join(target, r))),
    settings: changed,
  };
}

export const idle = (p: Plan): boolean =>
  [p.create, p.clash, p.refresh, p.sounds, p.stale].every((l) => l.length === 0) && !p.settings;
