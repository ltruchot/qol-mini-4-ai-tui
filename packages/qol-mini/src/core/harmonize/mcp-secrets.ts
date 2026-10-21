// Literal values, not variable references: named so nothing copies a secret
// silently. Env values and headers count; `Bearer ${TOKEN}` is a reference.
import { isReference } from "./mcp-env.ts";

type Json = Record<string, unknown>;

export function literalSecrets(server: Json): string[] {
  const out: string[] = [];
  const env = (server["environment"] ?? server["env"]) as Json | undefined;
  for (const [k, v] of Object.entries(env ?? {}))
    if (typeof v === "string" && !isReference(v)) out.push(`env ${k}`);
  const headers = (server["headers"] ?? {}) as Json;
  for (const [k, v] of Object.entries(headers))
    if (typeof v === "string" && !isReference(v)) out.push(`header ${k}`);
  return out;
}
