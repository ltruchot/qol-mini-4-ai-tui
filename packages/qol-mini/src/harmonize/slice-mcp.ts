import { ccToOcServer, ocToCcServer } from "../core/harmonize/mcp.ts";
import { literalSecrets } from "../core/harmonize/mcp-secrets.ts";
import type { Json } from "./read.ts";
import { mergeServers } from "./config-merge.ts";
import type { MergeOut } from "./plan-io.ts";

// One direction of the MCP slice: convert every server of the source block,
// merge into the target block, name a server carrying literal values (not
// ${VAR} references) and a name the target holds: nothing copies a secret or
// overwrites a server the user wrote.
function servers(
  from: Json,
  fromKey: string,
  to: Json,
  toKey: "mcp" | "mcpServers",
  prev: string[],
  convert: (server: Json) => Json | null,
  label: string,
): MergeOut {
  const add: Record<string, Json> = {};
  const warnings: string[] = [];
  const block = from[fromKey];
  if (block !== undefined && (typeof block !== "object" || Array.isArray(block)))
    return { mine: [], warnings: ["mcp block in the source is not an object, left untouched"] };
  for (const [name, server] of Object.entries(block as Json)) {
    const out = convert(server as Json);
    if (out === null) warnings.push(`mcp server ${name} has no ${label} form`);
    else {
      add[name] = out;
      for (const secret of literalSecrets(out))
        warnings.push(`mcp server ${name} carries a literal ${secret}`);
    }
  }
  const { mine, skipped } = mergeServers(to, toKey, prev, add);
  warnings.push(...skipped.map((name) => `mcp server ${name} exists, never written by this kit`));
  return { mine, warnings };
}

// .mcp.json -> opencode.json `mcp`
export function mcpToOc(mcp: Json, config: Json, prev: string[]): MergeOut {
  return servers(mcp, "mcpServers", config, "mcp", prev, ccToOcServer, "OpenCode");
}

// opencode.json `mcp` -> .mcp.json
export function mcpToCc(config: Json, mcp: Json, prev: string[]): MergeOut {
  return servers(config, "mcp", mcp, "mcpServers", prev, ocToCcServer, "Claude Code");
}
