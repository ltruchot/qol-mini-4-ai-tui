// Build the gates for WASI and copy them where the package ships them
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const BUILT = join(ROOT, "target", "wasm32-wasip1", "release");
const SHIPPED = join(ROOT, "packages", "qol-mini", "wasm");

execFileSync("cargo", ["xtask", "wasm"], { cwd: ROOT, stdio: "inherit" });
mkdirSync(SHIPPED, { recursive: true });
for (const gate of ["agents-md-chkr", "skills-chkr"]) {
  copyFileSync(join(BUILT, `${gate}.wasm`), join(SHIPPED, `${gate}.wasm`));
  console.log(`wasm: ${gate}.wasm`);
}
