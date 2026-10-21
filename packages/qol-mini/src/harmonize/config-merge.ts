// Merge MCP servers into a server map: `mcp.servers` on opencode.json,
// `mcpServers` on .mcp.json. Our keys are `mcp:<name>`: a re-run drops ours
// that left the source, keeps servers the user wrote, skips foreign names.
type Json = Record<string, unknown>;
const key = (name: string): string => `mcp:${name}`;

export function mergeServers(
  servers: Json,
  prev: string[],
  add: Record<string, Json>,
  taken: string[],
): { mine: string[]; skipped: string[] } {
  const owned = new Set(prev);
  for (const name of Object.keys(servers))
    if (owned.has(key(name)) && !(name in add)) Reflect.deleteProperty(servers, name);
  const skipped: string[] = [];
  for (const [name, server] of Object.entries(add)) {
    const foreign = taken.includes(name) || (name in servers && !owned.has(key(name)));
    if (foreign) skipped.push(name);
    else servers[name] = server;
  }
  const mine = Object.keys(add)
    .filter((name) => !skipped.includes(name))
    .map((name) => key(name));
  return { mine, skipped };
}
