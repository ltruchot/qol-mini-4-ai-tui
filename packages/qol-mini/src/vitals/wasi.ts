import { readFile } from "node:fs/promises";
import type { WASI } from "node:wasi";
import { engine } from "./engine.ts";
import type { View } from "./guest.ts";

type Emit = typeof process.emitWarning;

// node:wasi warns on load that it is experimental. That line on stderr is
// noise in a gate's output: drop that one warning, pass every other.
async function load(): Promise<typeof WASI> {
  const emit = process.emitWarning.bind(process);
  const quiet = ((warning: string | Error, ...rest: unknown[]) => {
    if (String(warning).startsWith("WASI is an experimental")) return;
    (emit as (...args: unknown[]) => void)(warning, ...rest);
  }) as Emit;
  process.emitWarning = quiet;
  try {
    return (await import("node:wasi")).WASI;
  } finally {
    process.emitWarning = emit;
  }
}

// Run one gate module; its stdout and stderr are the process's own. The
// result is the gate's exit status: 0 pass, 1 a probe failed, 2 unreadable.
export async function runGate(file: string, flags: string[], view: View): Promise<number> {
  const Wasi = await load();
  const wasi = new Wasi({
    version: "preview1",
    args: ["qol-mini vitals", view.repo, ...flags],
    env: view.home === undefined ? {} : { HOME: view.home },
    preopens: { "/": view.preopen },
    returnOnExit: true,
  });
  const module = await engine.compile(await readFile(file));
  const instance = await engine.instantiate(module, wasi.getImportObject());
  return wasi.start(instance);
}
