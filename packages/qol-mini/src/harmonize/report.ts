import type { Plan } from "./plan-types.ts";

// What a run plans to do, one line per move or file
export function report(p: Plan): string[] {
  const lines = [`from ${p.from}: rules ${p.state} -> ${p.rulesMode}`];
  for (const intent of p.intents) lines.push(intentLine(intent));
  for (const file of p.files) lines.push(`write ${file.rel} (${file.kind})`);
  for (const warning of p.warnings) lines.push(`warning: ${warning}`);
  for (const note of p.notes) lines.push(note);
  for (const conflict of p.conflicts) lines.push(`conflict: ${conflict}`);
  return lines;
}

const intentLine = (intent: Plan["intents"][number]): string => {
  if (intent.op === "mv") return `mv ${intent.path} -> ${intent.to}`;
  if (intent.op === "symlink") return `symlink ${intent.path} -> ${intent.to}`;
  if (intent.op === "write")
    return `write ${intent.path} (${intent.content === undefined ? "@AGENTS.md" : "merged"})`;
  return `rm ${intent.path}`;
};

export const idle = (p: Plan): boolean => p.intents.length === 0 && p.files.length === 0;

// Machine output: the plan without bytes
export function jsonOf(p: Plan): Record<string, unknown> {
  return {
    from: p.from,
    rules: { mode: p.rulesMode, state: p.state },
    intents: p.intents,
    files: p.files.map((f) => ({ kind: f.kind, path: f.rel, sources: f.sources, mine: f.mine })),
    warnings: p.warnings,
    notes: p.notes,
    conflicts: p.conflicts,
  };
}
