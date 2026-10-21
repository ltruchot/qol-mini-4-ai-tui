import type { LockFile } from "../core/schema/lock.ts";
import { stdinIsConsole } from "../io/console.ts";
import { readLock } from "../io/lock.ts";
import { findRoot, paths } from "../io/paths.ts";
import { resolve } from "node:path";

export type HOpts = {
  cwd?: string;
  yes?: boolean;
  json?: boolean;
  dryRun?: boolean;
  replace?: boolean;
  // raw flag values, validated by optsOf
  from?: unknown;
  rules?: unknown;
  only?: unknown;
};

export type HCtx = { root: string; lock: LockFile; yes: boolean; json: boolean; dryRun: boolean };

// A named project is taken as given; without one, walk up from cwd to .git.
// The lock may not exist yet: a first run creates it.
export async function hContext(opts: HOpts, project?: string): Promise<HCtx> {
  const base = opts.cwd ?? process.cwd();
  const root = project === undefined ? findRoot(base) : resolve(base, project);
  return {
    root,
    lock: await readLock(paths(root)),
    yes: opts.yes === true || !stdinIsConsole(),
    json: opts.json === true,
    dryRun: opts.dryRun === true,
  };
}
