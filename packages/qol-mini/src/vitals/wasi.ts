import { readFile } from "node:fs/promises";
import { engine } from "./engine.ts";
import type { View } from "./guest.ts";
import type { Sink } from "./wasi/fds.ts";
import { wasiHost } from "./wasi/host.ts";

export type Run = { flags: string[]; view: View; out?: Sink };

// Run one gate module; its stderr is the process's own, its stdout too unless
// `out` captures it. The result is the gate's exit status: 0 pass, 1 a probe
// failed, 2 unreadable.
export async function runGate(file: string, run: Run): Promise<number> {
  const { flags, view, out = process.stdout } = run;
  const env = view.home === undefined ? [] : [`HOME=${view.home}`];
  const host = wasiHost(view.preopen, ["qol-mini vitals", view.repo, ...flags], env, out);
  const module = await engine.compile(await readFile(file));
  const instance = await engine.instantiate(module, host.imports);
  return host.run(instance.exports);
}
