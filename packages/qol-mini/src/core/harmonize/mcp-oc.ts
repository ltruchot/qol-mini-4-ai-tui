// Where an OpenCode config keeps its MCP servers. OpenCode 2.1 reads both the
// native `mcp.servers` map and the legacy flat `mcp.<name>` entries
// (config/normalize.ts); the kit reads both and writes the native map.
type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isServer = (v: unknown): v is Json =>
  isObject(v) && (v["type"] === "local" || v["type"] === "remote");

export function ocServers(config: Json): {
  legacy: Record<string, Json>;
  native: Record<string, Json>;
} {
  const legacy: Record<string, Json> = {};
  const native: Record<string, Json> = {};
  const mcp = config["mcp"];
  if (!isObject(mcp)) return { legacy, native };
  for (const [name, value] of Object.entries(mcp)) {
    if (name === "servers" && isObject(value) && !isServer(value)) {
      for (const [n, v] of Object.entries(value)) if (isServer(v)) native[n] = v;
    } else if (isServer(value)) legacy[name] = value;
  }
  return { legacy, native };
}

// The native map of a config, created on demand; `put` writes it back,
// dropping the empty containers it leaves
export function nativeOf(config: Json): { servers: Json; put: () => void } {
  const mcp = isObject(config["mcp"]) ? config["mcp"] : {};
  const servers: Json = isObject(mcp["servers"]) ? { ...mcp["servers"] } : {};
  const put = (): void => {
    if (Object.keys(servers).length > 0) mcp["servers"] = servers;
    else Reflect.deleteProperty(mcp, "servers");
    if (Object.keys(mcp).length > 0) config["mcp"] = mcp;
    else Reflect.deleteProperty(config, "mcp");
  };
  return { servers, put };
}
