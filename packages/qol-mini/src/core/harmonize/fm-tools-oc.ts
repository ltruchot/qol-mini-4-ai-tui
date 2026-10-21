import { ocToCcName } from "./fm-tools-map.ts";

// OpenCode `tools` map -> Claude Code `allowed-tools` list. A pattern value
// keeps the tool and is named in `lossy`: the list holds no pattern either.
export function ocToCcTools(tools: unknown): { allowed: string[]; lossy: string[] } {
  const map = (tools ?? {}) as Record<string, unknown>;
  const allowed: string[] = [];
  const lossy: string[] = [];
  for (const [oc, on] of Object.entries(map)) {
    if (on === false || on === "deny") continue;
    const cc = ocToCcName(oc);
    if (cc === undefined) {
      lossy.push(oc);
      continue;
    }
    allowed.push(cc);
    if (typeof on === "string" && on !== "allow" && on !== "true") lossy.push(`${oc}: ${on}`);
  }
  return { allowed, lossy };
}
