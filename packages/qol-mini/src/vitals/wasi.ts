import { readFile } from "node:fs/promises";
import { engine } from "./engine.ts";
import type { View } from "./guest.ts";
import { wasiHost } from "./wasi/host.ts";

// Run one gate module; its stdout and stderr are the process's own. The
// result is the gate's exit status: 0 pass, 1 a probe failed, 2 unreadable.
export async function runGate(file: string, flags: string[], view: View): Promise<number> {
  const env = view.home === undefined ? [] : [`HOME=${view.home}`];
  const host = wasiHost(view.preopen, ["qol-mini vitals", view.repo, ...flags], env);
  const module = await engine.compile(await readFile(file));
  const instance = await engine.instantiate(module, host.imports);
  return host.run(instance.exports);
}
