import { literalSecrets } from "../core/harmonize/mcp-secrets.ts";
import type { Json } from "./read.ts";

type Convert = (server: Json, lossy: string[]) => Json | null;
type Converted = { add: Record<string, Json>; warnings: string[] };

// Convert every server, naming what is lossy, what carries a literal value
// (not a variable reference) and what has no form on the other side
export function convertAll(from: Record<string, Json>, convert: Convert, label: string): Converted {
  const add: Record<string, Json> = {};
  const warnings: string[] = [];
  for (const [name, server] of Object.entries(from)) {
    const lossy: string[] = [];
    const out = convert(server, lossy);
    warnings.push(...lossy.map((l) => `mcp server ${name}: ${l}`));
    if (out === null) warnings.push(`mcp server ${name} has no ${label} form, or is disabled`);
    else {
      add[name] = out;
      for (const s of literalSecrets(out))
        warnings.push(`mcp server ${name} carries a literal ${s}`);
    }
  }
  return { add, warnings };
}
