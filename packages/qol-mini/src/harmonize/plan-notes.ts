import { hookTarget } from "../core/harmonize/hooks-map.ts";
import type { RuleMode, Side } from "../core/schema/harmony.ts";
import type { Intent } from "./plan-types.ts";
import type { Detect } from "./detect.ts";

// What the run reports without writing: skills OpenCode discovers on its own,
// hooks and statusLine with no OpenCode form, files that change the verdict.
export function notesFor(
  det: Detect,
  from: Side,
  mode: RuleMode,
  settings: Record<string, unknown> | undefined,
  intents: Intent[],
): { notes: string[]; warnings: string[] } {
  const notes: string[] = [];
  const warnings: string[] = [];
  if (det.state === "none") notes.push("rules: no rules file, nothing renamed");
  if (det.markers.cc.skills.length > 0)
    notes.push(
      `skills: OpenCode discovers ${det.markers.cc.skills.join(", ")} from .claude/skills`,
    );
  for (const event of det.hooks)
    if (from === "claude") notes.push(`hook ${event} -> ${hookTarget(event)}`);
  if (settings?.["statusLine"] !== undefined) notes.push("statusLine: no OpenCode form");
  if (det.markers.cc.local) notes.push("settings.local.json is machine-local, not converted");
  if (det.cursorrules) notes.push(".cursorrules predates AGENTS.md, safe to delete");
  if (mode === "pure" && intents.some((i) => i.op === "mv") && det.gotchas.length > 0)
    warnings.push(
      `pure AGENTS.md stays unread in Claude Code while ${det.gotchas.join(", ")} sit in or above the repo; --rules bridge keeps Claude Code reading it`,
    );
  else
    for (const gotcha of det.gotchas) notes.push(`${gotcha} suppresses AGENTS.md in Claude Code`);
  return { notes, warnings };
}
