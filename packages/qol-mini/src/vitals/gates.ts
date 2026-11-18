import { existsSync } from "node:fs";
import { join } from "node:path";
import { fail } from "../io/ui.ts";
import { packageRoot } from "../io/bank-dir.ts";

// Gate name on the command line, and the module that judges it
const MODULES: Record<string, string> = {
  "agents-md": "agents-md-chkr.wasm",
  skills: "skills-chkr.wasm",
};

export const GATES = Object.keys(MODULES);

export function isGate(word: string): boolean {
  return Object.hasOwn(MODULES, word);
}

// The gates are Rust built for WASI, shipped in the package under wasm/
export function gateModule(gate: string): string {
  const file = join(packageRoot(), "wasm", MODULES[gate] ?? "");
  if (!existsSync(file)) fail(`${gate} gate is not built: ${file} is missing, run vp run wasm`);
  return file;
}
