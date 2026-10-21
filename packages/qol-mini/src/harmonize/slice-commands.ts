import { plain, unknownKeys, type Fm } from "../core/harmonize/fm-agent-map.ts";
import { toCcModel, toOcModel } from "../core/harmonize/model.ts";

// Command frontmatter. OpenCode 2.1 knows `description`, `agent`, `model` and
// `subagent`; Claude Code runs a command in a subagent with `context: fork`
// and `agent`. `allowed-tools` grants tools without asking for one turn:
// OpenCode has no per-command grant, so it is named, not converted. The body
// travels untouched: `$ARGUMENTS`, `$1` and `` !`cmd` `` read the same in both.
const CC_KNOWN = ["name", "description", "model", "context", "agent"];
const OC_KNOWN = ["description", "model", "agent", "subagent", "subtask"];

export function ccToOcCommand(data: Record<string, unknown>): Fm {
  const lossy = unknownKeys(data, CC_KNOWN, "OpenCode");
  const out: Record<string, unknown> = { description: data["description"] };
  const model = plain(data["model"]);
  if (model !== null && model !== "inherit") {
    out["model"] = toOcModel(model) ?? undefined;
    if (out["model"] === undefined) lossy.push(`model ${model} has no provider/model form`);
  }
  if (data["context"] === "fork") {
    out["subagent"] = true;
    if (data["agent"] !== undefined) out["agent"] = data["agent"];
  } else if (data["agent"] !== undefined) lossy.push("agent without context: fork is ignored");
  return { data: out, lossy };
}

export function ocToCcCommand(data: Record<string, unknown>): Fm {
  const lossy = unknownKeys(data, OC_KNOWN, "Claude Code");
  const out: Record<string, unknown> = { description: data["description"] };
  const model = plain(data["model"]);
  if (model !== null) out["model"] = toCcModel(model) ?? undefined;
  if (model !== null && out["model"] === undefined) lossy.push(`model ${model}`);
  const forked = (data["subagent"] ?? data["subtask"]) === true;
  if (forked) out["context"] = "fork";
  if (data["agent"] !== undefined) {
    if (forked) out["agent"] = data["agent"];
    else lossy.push(`agent ${plain(data["agent"]) ?? "?"}: Claude Code runs it inline`);
  }
  return { data: out, lossy };
}
