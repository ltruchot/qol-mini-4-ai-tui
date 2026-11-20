// Fail when the packed manifest still holds pnpm protocols or lost its bin
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PKG = join(process.cwd(), "packages", "qol-mini");
const out = mkdtempSync(join(tmpdir(), "qol-mini-pack-"));

try {
  execFileSync("vp", ["pm", "pack", "--pack-destination", out], { cwd: PKG, stdio: "ignore" });
  const tgz = readdirSync(out).find((f) => f.endsWith(".tgz"));
  if (tgz === undefined) throw new Error("no tarball produced");
  const manifest = execFileSync("tar", ["-xOf", join(out, tgz), "package/package.json"], {
    encoding: "utf8",
  });
  const pkg = JSON.parse(manifest) as {
    bin?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  const deps = Object.entries(pkg.dependencies ?? {});
  if (deps.length > 0)
    throw new Error(`runtime deps must be bundled, found: ${deps.map(([k]) => k).join(", ")}`);
  if (manifest.includes("catalog:") || manifest.includes("workspace:"))
    throw new Error("unresolved pnpm protocol in manifest");
  const bins = Object.values(pkg.bin ?? {});
  if (bins.length !== 1 || bins[0] !== "dist/cli.js")
    throw new Error(`bin missing or wrong: ${JSON.stringify(pkg.bin)}`);
  const listing = execFileSync("tar", ["-tf", join(out, tgz)], { encoding: "utf8" });
  for (const gate of ["agents-md-chkr", "skills-chkr"])
    if (!listing.includes(`package/wasm/${gate}.wasm`))
      throw new Error(`${gate}.wasm is not in the tarball: run vp run wasm before packing`);
  // The rules files of the repository stay in it: `files` excludes the nested ones
  if (/(^|\/)AGENTS\.md$/mu.test(listing))
    throw new Error("an AGENTS.md is in the tarball: exclude it in the files field");
  console.log("packcheck: ok (zero runtime deps, bin present, gates shipped)");
} finally {
  rmSync(out, { recursive: true, force: true });
}
