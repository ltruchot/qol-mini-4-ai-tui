import type { CAC } from "cac";
import { scan } from "../harmonize/scan.ts";
import { intro, outro, print, warn } from "../io/ui.ts";
import { resolve } from "node:path";
import type { HOpts } from "./harmonize-ctx.ts";

// Find repos to harmonize under the named roots. Never a whole disk: name
// each root. A repo holds .git; scan writes nothing.
export async function runScan(roots: string[], opts: HOpts): Promise<number> {
  if (roots.length === 0) {
    if (opts.json !== true) {
      intro("qol-mini harmonize scan");
      outro("name one or more roots: qol-mini harmonize scan ~/workspace");
    }
    return 1;
  }
  const base = opts.cwd ?? process.cwd();
  const { hits, errors } = await scan(roots.map((root) => resolve(base, root)));
  if (opts.json === true) {
    print([JSON.stringify({ hits, errors })]);
    return 0;
  }
  intro("qol-mini harmonize scan");
  for (const error of errors) warn(error);
  for (const hit of hits)
    print([
      `${hit.root} (from ${hit.from}, rules ${hit.state}${hit.harmonized ? ", harmonized" : ""})`,
    ]);
  for (const hit of hits) print([`qol-mini harmonize ${hit.root}`]);
  outro(`${hits.length} repo(s), nothing written`);
  return 0;
}

export function register(cli: CAC): void {
  cli.command("scan [...roots]", "List repos to harmonize under each root").action(runScan);
}
