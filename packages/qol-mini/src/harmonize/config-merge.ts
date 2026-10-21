// Merge MCP servers in and out of a parsed config: `mcp` on opencode.json,
// `mcpServers` on .mcp.json. Our keys are `mcp:<name>`: a re-run drops ours
// that left the source, keeps servers the user wrote, skips foreign names.
type Json = Record<string, unknown>;
const key = (name: string): string => `mcp:${name}`;

export function mergeServers(
  target: Json,
  field: "mcp" | "mcpServers",
  prev: string[],
  add: Record<string, Json>,
): { mine: string[]; skipped: string[] } {
  const raw = target[field];
  if (raw !== undefined && (typeof raw !== "object" || Array.isArray(raw)))
    return { mine: [], skipped: Object.keys(add) };
  const servers: Json = (raw as Json) ?? {};
  const owned = new Set(prev);
  for (const name of Object.keys(servers))
    if (owned.has(key(name)) && !(name in add)) Reflect.deleteProperty(servers, name);
  const skipped: string[] = [];
  for (const [name, server] of Object.entries(add)) {
    const foreign = name in servers && !owned.has(key(name));
    if (foreign) {
      skipped.push(name);
      continue;
    }
    servers[name] = server;
  }
  if (Object.keys(servers).length === 0) Reflect.deleteProperty(target, field);
  else target[field] = servers;
  const mine = Object.entries(add)
    .filter(([name]) => !skipped.includes(name))
    .map(([name]) => key(name));
  return { mine, skipped };
}
