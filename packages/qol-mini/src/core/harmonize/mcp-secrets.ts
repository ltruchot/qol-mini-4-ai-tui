// Literal values, not ${VAR} references: named so nothing copies a secret
// silently. `Authorization` headers and plain env values both count.
type Json = Record<string, unknown>;

export function literalSecrets(server: Json): string[] {
  const out: string[] = [];
  const env = (server["environment"] ?? server["env"]) as Json | undefined;
  for (const [k, v] of Object.entries(env ?? {})) {
    if (typeof v === "string" && !v.startsWith("${")) out.push(`env ${k}`);
  }
  const headers = (server["headers"] ?? {}) as Json;
  for (const [k, raw] of Object.entries(headers)) {
    const value =
      typeof raw === "string" ? raw : ((raw as Json)["Authorization"] as string | undefined);
    if (value !== undefined && !value.startsWith("${")) out.push(`header ${k}`);
  }
  return out;
}
