// One MCP server, both formats. Claude Code: `command` + `args` + `env` (stdio) or
// `type: http` + `url`. OpenCode: `type: local` + command array, or `type: remote`.
type Json = Record<string, unknown>;

export function ccToOcServer(server: Json): Json | null {
  const out: Json = {};
  if (typeof server["url"] === "string") {
    out["type"] = "remote";
    out["url"] = server["url"];
    if (server["headers"] !== undefined) out["headers"] = server["headers"];
    return out;
  }
  const command = server["command"];
  if (typeof command !== "string") return null;
  const args = Array.isArray(server["args"]) ? server["args"].map(String) : [];
  out["type"] = "local";
  out["command"] = [command, ...args];
  if (server["env"] !== undefined) out["environment"] = server["env"];
  return out;
}

export function ocToCcServer(server: Json): Json | null {
  const out: Json = {};
  if (server["type"] === "remote" || typeof server["url"] === "string") {
    out["type"] = "http";
    if (typeof server["url"] === "string") out["url"] = server["url"];
    if (server["headers"] !== undefined) out["headers"] = server["headers"];
    return out;
  }
  const command = server["command"];
  if (!Array.isArray(command) || command.length === 0) return null;
  out["command"] = command[0];
  if (command.length > 1) out["args"] = command.slice(1);
  if (server["environment"] !== undefined) out["env"] = server["environment"];
  return out;
}
