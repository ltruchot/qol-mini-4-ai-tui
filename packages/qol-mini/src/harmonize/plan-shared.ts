import { readJson } from "./read.ts";
import type { Reads } from "./plan-io.ts";

// Read the three JSON files every direction needs: Claude Code settings, the
// OpenCode config, the shared .mcp.json.
export async function readConfigs(lay: {
  settings: string;
  ocConfig: string;
  mcpJson: string;
}): Promise<Reads> {
  const [settings, ocConfig, mcpJson] = await Promise.all([
    readJson(lay.settings),
    readJson(lay.ocConfig),
    readJson(lay.mcpJson),
  ]);
  return { settings, ocConfig, mcpJson } satisfies Reads;
}
