import { CC_TO_OC, parseAllowed } from "./fm-tools-map.ts";

export type Tools = { tools: Record<string, boolean>; lossy: string[] };

// `allowed-tools` -> OpenCode `tools` map. Tool patterns flatten to `true`
// and land in `lossy`, named: the map holds no pattern of its own.
export function ccToOcTools(allowed: unknown): Tools {
  const tools: Record<string, boolean> = {};
  const lossy: string[] = [];
  for (const tool of parseAllowed(allowed)) {
    const bare = tool.replace(/\(.*\)$/, "");
    const oc = CC_TO_OC[bare];
    if (oc === undefined) {
      lossy.push(tool);
      continue;
    }
    if (tools[oc] === true) continue;
    tools[oc] = true;
    if (bare !== tool) lossy.push(tool);
  }
  return { tools, lossy };
}
