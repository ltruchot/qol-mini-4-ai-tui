import { z } from "zod";
import { gateModule } from "./gates.ts";
import type { View } from "./guest.ts";
import { runGate } from "./wasi.ts";

// What a gate prints under --json. The gate judges; this only reads it.
const Finding = z.object({
  probe: z.string(),
  scope: z.enum(["repository", "user"]),
  command: z.array(z.string()).nullable(),
});
const Report = z.object({ gate: z.string(), passed: z.boolean(), findings: z.array(Finding) });

export type Report = z.infer<typeof Report>;
export type Target = { gates: string[]; flags: string[]; view: View };

// One gate run with its stdout kept: the JSON report, empty when unreadable
async function capture(gate: string, { flags, view }: Target): Promise<[number, string]> {
  const chunks: Uint8Array[] = [];
  const out = { write: (data: Uint8Array): number => chunks.push(Uint8Array.from(data)) };
  const code = await runGate(gateModule(gate), { flags: [...flags, "--json"], view, out });
  return [code, Buffer.concat(chunks).toString("utf8").trim()];
}

// Every gate, in order: the worst exit status and the reports that came out
export async function captureAll(target: Target): Promise<{ worst: number; reports: string[] }> {
  const runs: [number, string][] = [];
  for (const gate of target.gates) runs.push(await capture(gate, target));
  const reports = runs.map(([, json]) => json).filter((json) => json !== "");
  return { worst: Math.max(0, ...runs.map(([code]) => code)), reports };
}

export const decode = (json: string): Report => Report.parse(JSON.parse(json));

// The commands the repository-scope findings name, each once, in probe order
export function commands(reports: Report[]): string[][] {
  const seen = new Map<string, string[]>();
  for (const { findings } of reports)
    for (const { scope, command } of findings)
      if (scope === "repository" && command !== null) seen.set(command.join(" "), command);
  return [...seen.values()];
}
