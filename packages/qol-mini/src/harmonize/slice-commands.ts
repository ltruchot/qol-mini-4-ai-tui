import { ccToOcTools } from "../core/harmonize/fm-tools.ts";
import { ocToCcTools } from "../core/harmonize/fm-tools-oc.ts";

// Command frontmatter: the body and the known keys travel, `allowed-tools`
// <-> `tools` convert, `name` stays in the filename, the rest is named lossy.
const KEEP = ["description", "argument-hint", "model", "effort"];

export function ccToOcCommand(data: Record<string, unknown>): {
  data: Record<string, unknown>;
  lossy: string[];
} {
  const out: Record<string, unknown> = {};
  const lossy: string[] = [];
  for (const key of KEEP) if (data[key] !== undefined) out[key] = data[key];
  if (data["allowed-tools"] !== undefined) {
    const { tools, lossy: lost } = ccToOcTools(data["allowed-tools"]);
    if (Object.keys(tools).length > 0) out["tools"] = tools;
    lossy.push(...lost);
  }
  for (const key of Object.keys(data))
    if (key !== "allowed-tools" && key !== "name" && !KEEP.includes(key))
      lossy.push(`${key} has no OpenCode form`);
  return { data: out, lossy };
}

export function ocToCcCommand(data: Record<string, unknown>): {
  data: Record<string, unknown>;
  lossy: string[];
} {
  const out: Record<string, unknown> = {};
  const lossy: string[] = [];
  for (const key of KEEP) if (data[key] !== undefined) out[key] = data[key];
  if (data["tools"] !== undefined) {
    const { allowed, lossy: lost } = ocToCcTools(data["tools"]);
    if (allowed.length > 0) out["allowed-tools"] = allowed;
    lossy.push(...lost);
  }
  for (const key of Object.keys(data))
    if (key !== "tools" && key !== "name" && key !== "agent" && !KEEP.includes(key))
      lossy.push(`${key} has no Claude Code form`);
  if (data["agent"] !== undefined) {
    const agent = typeof data["agent"] === "string" ? data["agent"] : JSON.stringify(data["agent"]);
    lossy.push(`agent ${agent} has no Claude Code form`);
  }
  return { data: out, lossy };
}
