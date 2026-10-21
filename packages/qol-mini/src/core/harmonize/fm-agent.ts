// Claude Code agent frontmatter -> OpenCode: `tools` list becomes a
// `permission` map, the model gains its provider prefix, cosmetics drop
import { toOcModel } from "./model.ts";
import { CC_TO_OC, type AgentFm, parseTools, plain } from "./fm-agent-map.ts";

export function ccToOcAgent(data: Record<string, unknown>): AgentFm {
  const fm: Record<string, unknown> = {
    name: data["name"],
    description: data["description"],
    mode: "subagent",
  };
  const lossy: string[] = [];
  const permission: Record<string, string> = {};
  for (const tool of parseTools(data["tools"])) {
    const oc = CC_TO_OC[tool.replace(/\(.*\)$/, "")];
    if (oc === undefined) {
      lossy.push(`tool ${tool}`);
      continue;
    }
    permission[oc] = "allow";
  }
  if (Object.keys(permission).length > 0) fm["permission"] = permission;
  const model = plain(data["model"]);
  if (model !== null) {
    const mapped = toOcModel(model);
    fm["model"] = mapped.model;
    if (!mapped.known) lossy.push(`model ${model}`);
  }
  for (const key of ["color", "effort"]) {
    const value = plain(data[key]);
    if (value !== null) lossy.push(`${key} ${value}`);
  }
  return { data: fm, lossy };
}
