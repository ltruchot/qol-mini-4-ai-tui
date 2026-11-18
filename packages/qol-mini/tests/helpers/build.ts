import { execa } from "execa";

// The installer copies the bundles in dist/, vitals runs the gates in wasm/:
// build both once per test run
export async function setup(): Promise<void> {
  await execa("vp", ["pack"], { cwd: `${import.meta.dirname}/../..` });
  await execa("node", ["scripts/wasm.ts"], { cwd: `${import.meta.dirname}/../../../..` });
}
