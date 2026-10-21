import { homedir } from "node:os";
import type { ScanHit } from "./scan-hit.ts";
import { walk } from "./scan-walk.ts";

export type { ScanHit } from "./scan-hit.ts";

// Find repos to harmonize under the named roots. Never a whole disk: "/" and
// the home directory are refused, narrower roots are required.
export async function scan(roots: string[]): Promise<{ hits: ScanHit[]; errors: string[] }> {
  const hits: ScanHit[] = [];
  const errors: string[] = [];
  for (const root of roots) {
    if (root === "/" || root === homedir())
      errors.push(`refusing to scan ${root}: name a narrower root`);
    else await walk(root, 0, hits, errors);
  }
  return { hits, errors };
}
