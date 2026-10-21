// OpenCode agent frontmatter -> Claude Code: the `permission` map becomes a
// `tools` list, the model keeps the name Claude Code resolves
import { toCcModel } from "./model.ts";
import { type AgentFm, ocToCcName, plain } from "./fm-agent-map.ts";

export function ocToCcAgent(data: Record<string, unknown>): AgentFm {
  const fm: Record<string, unknown> = { name: data["name"], description: data["description"] };
  const lossy: string[] = [];
  const perm = (data["permission"] ?? {}) as Record<string, unknown>;
  const tools: string[] = [];
  for (const [oc, on] of Object.entries(perm)) {
    if (on === false || on === "deny") continue;
    const cc = ocToCcName(oc);
    if (cc === undefined) {
      lossy.push(`tool ${oc}`);
      continue;
    }
    tools.push(cc);
    if (typeof on === "string" && on !== "allow") lossy.push(`${oc}: ${on}`);
  }
  if (tools.length > 0) fm["tools"] = tools;
  const model = plain(data["model"]);
  if (model !== null) {
    const mapped = toCcModel(model);
    fm["model"] = mapped.model;
    if (!mapped.known) lossy.push(`model ${model}`);
  }
  if (data["mode"] === "primary") lossy.push("mode primary has no Claude Code subagent");
  return { data: fm, lossy };
}
