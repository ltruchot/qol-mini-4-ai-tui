import { execa } from "execa";

// The installer copies the bundles in dist/: build them once per test run.
// The gates in wasm/ are built before, by `vp run wasm`: the task cache that
// runs the tests filters the environment the Rust toolchain is selected by.
export async function setup(): Promise<void> {
  await execa("vp", ["pack"], { cwd: `${import.meta.dirname}/../..` });
}
