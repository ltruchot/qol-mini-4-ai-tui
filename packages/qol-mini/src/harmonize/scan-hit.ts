import type { Side } from "../core/schema/harmony.ts";
import type { RulesState } from "../core/harmonize/rules.ts";
import { readLock } from "../io/lock.ts";
import { paths } from "../io/paths.ts";
import { detect } from "./detect.ts";
import { layout } from "./layout.ts";

export type ScanHit = { root: string; from: Side; state: RulesState; harmonized: boolean };

// One repo's answer for the scan: which side holds it, its rules layout,
// whether our lock is already there. A repo that fails to answer is skipped.
export async function scanHit(root: string): Promise<ScanHit | null> {
  try {
    const det = await detect(await layout(root), root);
    const lock = await readLock(paths(root));
    return {
      root,
      from: det.markers.from,
      state: det.state,
      harmonized: lock.harmonize !== undefined,
    };
  } catch {
    return null;
  }
}
