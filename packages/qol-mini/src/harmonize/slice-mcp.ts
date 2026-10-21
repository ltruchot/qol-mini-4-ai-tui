import { ccToOcServer, ocToCcServer } from "../core/harmonize/mcp.ts";
import { nativeOf, ocServers } from "../core/harmonize/mcp-oc.ts";
import type { Json } from "./read.ts";
import { mergeServers } from "./config-merge.ts";
import { convertAll } from "./mcp-convert.ts";
import type { MergeOut } from "./plan-io.ts";

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const named = (skipped: string[]): string[] =>
  skipped.map((name) => `mcp server ${name} exists, never written by this kit`);

// .mcp.json -> opencode.json `mcp.servers`. A name the legacy flat form holds
// is the user's: OpenCode would load both under one name.
export function mcpToOc(mcp: Json, config: Json, prev: string[]): MergeOut {
  const block = mcp["mcpServers"];
  if (block !== undefined && !isObject(block))
    return { mine: [], warnings: [".mcp.json mcpServers is not an object, left untouched"] };
  const { add, warnings } = convertAll(
    (block ?? {}) as Record<string, Json>,
    ccToOcServer,
    "OpenCode",
  );
  const target = nativeOf(config);
  const taken = Object.keys(ocServers(config).legacy);
  const { mine, skipped } = mergeServers(target.servers, prev, add, taken);
  target.put();
  return { mine, warnings: [...warnings, ...named(skipped)] };
}

// opencode.json, both forms -> .mcp.json `mcpServers`
export function mcpToCc(config: Json, mcp: Json, prev: string[]): MergeOut {
  const { legacy, native } = ocServers(config);
  const { add, warnings } = convertAll({ ...legacy, ...native }, ocToCcServer, "Claude Code");
  const servers = isObject(mcp["mcpServers"]) ? { ...mcp["mcpServers"] } : {};
  const { mine, skipped } = mergeServers(servers, prev, add, []);
  if (Object.keys(servers).length > 0) mcp["mcpServers"] = servers;
  else Reflect.deleteProperty(mcp, "mcpServers");
  return { mine, warnings: [...warnings, ...named(skipped)] };
}
