import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { print } from "../io/ui.ts";
import { row } from "../kit/report.ts";
import { saveNamed } from "../kit/save-settings.ts";
import { openIdle, type OpenPlan } from "./plan.ts";

// Write the plan, mirroring the Claude target: created and replaced files,
// then cli.json, stale files last. Nothing is written when the plan is idle.
// `plugin` is true when the plugin files changed: they load at service start
// only.
export function applyOpen(p: OpenPlan): { plugin: boolean } | null {
  if (openIdle(p)) return null;
  print([`Installing into ${p.target}`]);
  for (const relative of [...p.d.create, ...p.d.clash].toSorted()) {
    mkdirSync(dirname(join(p.target, relative)), { recursive: true });
    writeFileSync(join(p.target, relative), p.wanted.get(relative) ?? "");
    row(p.d.clash.includes(relative) ? "replaced" : "created", relative);
  }
  for (const relative of p.d.same) row("unchanged", relative);
  if (p.cli.changed) {
    const copy = saveNamed(p.target, "cli.json", p.cli.after);
    if (copy !== null) row("backup", copy.slice(p.target.length + 1));
    row("updated", "cli.json");
  }
  for (const relative of p.stale) {
    unlinkSync(join(p.target, relative));
    row("removed", relative);
  }
  return { plugin: p.plugin };
}
