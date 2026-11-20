import { dirCalls } from "./dirs.ts";
import { ExitError, guard } from "./errno.ts";
import { context, type Calls, type Ctx, type Sink } from "./fds.ts";
import { fileCalls } from "./files.ts";
import { Mem, type Memory } from "./mem.ts";
import { metaCalls } from "./meta.ts";
import { pathCalls } from "./paths.ts";
import { preopenCalls } from "./preopen.ts";
import { processCalls } from "./process.ts";

export type Guest = { memory: Memory; _start: () => void };
export type Host = { imports: object; run: (guest: Guest) => number };

// A WASI preview1 host for the gates: the eighteen calls they import, over a
// read-only view of one host directory. stderr is the process's, stdout goes
// to `out`.
export function wasiHost(root: string, args: string[], env: string[], out: Sink): Host {
  const ctx = context({ root, args, env, out }) as Ctx;
  const calls: Calls = {
    ...processCalls(ctx),
    ...fileCalls(ctx),
    ...dirCalls(ctx),
    ...preopenCalls(ctx),
    ...pathCalls(ctx),
    ...metaCalls(ctx),
  };
  const guarded: Calls = {};
  for (const [name, call] of Object.entries(calls))
    guarded[name] = (...given: never[]): number => guard(() => call(...given));
  return {
    imports: { wasi_snapshot_preview1: guarded },
    run: (guest) => {
      ctx.mem = new Mem(guest.memory);
      try {
        guest._start();
        return 0;
      } catch (error) {
        if (error instanceof ExitError) return error.status;
        throw error;
      }
    },
  };
}
