// One MCP server, both formats. Claude Code (.mcp.json): stdio `command` +
// `args` + `env`, or `type: http|sse` + `url` + `headers`. OpenCode 2.1
// (`mcp.servers`): `type: local` + command array + `environment`, or
// `type: remote` + `url` + `headers`. Keys with no counterpart land in `lossy`.
import { mapStrings, toCcEnv, toOcEnv } from "./mcp-env.ts";

type Json = Record<string, unknown>;
const CC_KEYS = new Set("type command args env url headers".split(" "));
const OC_KEYS = new Set("type command environment url headers enabled disabled".split(" "));
const extra = (server: Json, known: Set<string>): string[] =>
  Object.keys(server)
    .filter((k) => !known.has(k))
    .map((k) => `${k} has no counterpart`);

export function ccToOcServer(server: Json, lossy: string[]): Json | null {
  lossy.push(...extra(server, CC_KEYS));
  const s = mapStrings(server, (v) => toOcEnv(v, lossy)) as Json;
  if (typeof s["url"] === "string" && s["type"] !== "stdio") {
    const out: Json = { type: "remote", url: s["url"] };
    if (s["headers"] !== undefined) out["headers"] = s["headers"];
    return out;
  }
  if (typeof s["command"] !== "string") return null;
  const args = Array.isArray(s["args"]) ? s["args"].map(String) : [];
  const out: Json = { type: "local", command: [s["command"], ...args] };
  if (s["env"] !== undefined) out["environment"] = s["env"];
  return out;
}

// A server switched off in OpenCode stays off: not converted, named
export function ocToCcServer(server: Json, lossy: string[]): Json | null {
  if (server["disabled"] === true || server["enabled"] === false) return null;
  lossy.push(...extra(server, OC_KEYS));
  const s = mapStrings(server, (v) => toCcEnv(v, lossy)) as Json;
  if (s["type"] === "remote") {
    const out: Json = { type: "http", url: s["url"] };
    if (s["headers"] !== undefined) out["headers"] = s["headers"];
    return out;
  }
  const command = s["command"];
  if (!Array.isArray(command) || command.length === 0) return null;
  const out: Json = { command: command[0] };
  if (command.length > 1) out["args"] = command.slice(1);
  if (s["environment"] !== undefined) out["env"] = s["environment"];
  return out;
}
