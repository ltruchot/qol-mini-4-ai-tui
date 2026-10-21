import { hashBytes } from "../core/hash/file.ts";
import type { Harmony } from "../core/schema/harmony.ts";
import type { Status } from "../core/status/buckets.ts";
import { exitCode, type ExitCode } from "../core/status/exit-code.ts";
import { exists } from "../io/fs.ts";
import { detect } from "./detect.ts";
import { layout } from "./layout.ts";
import { rulesStatus } from "./check-rules.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type Row = { path: string; status: Status };

// The rules verdict is a layout question, not a hash: AGENTS.md stays the
// user's file. Generated files are checked by hash, their sources by hash.
export async function checkHarmony(
  root: string,
  harmony: Harmony,
): Promise<{ rows: Row[]; worst: ExitCode }> {
  const lay = await layout(root);
  const det = await detect(lay, root);
  const rules = rulesStatus(det.state, harmony.rules, harmony.ops.length > 0);
  const rows: Row[] = [{ path: "rules", status: rules }];
  for (const [key, art] of Object.entries(harmony.artifacts)) {
    const file = join(root, key);
    if (!(await exists(file))) {
      rows.push({ path: key, status: "missing" });
      continue;
    }
    const onDisk = hashBytes(await readFile(file));
    let status: Status = onDisk === art.hash ? "ok" : "drift";
    if (status === "ok" && (await sourceMoved(root, art.sources))) status = "update";
    rows.push({ path: `${key} (${art.kind})`, status });
  }
  return { rows, worst: exitCode(rows.map((r) => r.status)) };
}

// Any source the artifact was converted from changed or vanished
async function sourceMoved(root: string, sources: Record<string, string>): Promise<boolean> {
  for (const [srcRel, srcHash] of Object.entries(sources)) {
    const src = join(root, srcRel);
    if (!(await exists(src))) return true;
    if (hashBytes(await readFile(src)) !== srcHash) return true;
  }
  return false;
}
