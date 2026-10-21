import { ccToOcAgent } from "../core/harmonize/fm-agent.ts";
import { ocToCcAgent } from "../core/harmonize/fm-agent-oc.ts";
import type { Artifact, Side } from "../core/schema/harmony.ts";
import type { Detect } from "./detect.ts";
import type { Layout } from "./layout.ts";
import type { Planned } from "./plan-types.ts";
import { ccToOcCommand, ocToCcCommand } from "./slice-commands.ts";
import { convertMds } from "./slice-md.ts";

export type MdsOut = { planned: Planned[]; warnings: string[]; notes: string[] };
type Kind = "command" | "agent";
type Convert = (data: Record<string, unknown>) => {
  data: Record<string, unknown>;
  lossy: string[];
};

// Commands and agents of the source of truth, converted to the other side,
// one guarded file per source file.
export async function convertBoth(
  from: Side,
  lay: Layout,
  det: Detect,
  root: string,
  prev: Record<string, Artifact>,
  replace: boolean,
): Promise<MdsOut> {
  const pair: [Kind, string, string, string[], Convert][] =
    from === "opencode"
      ? [
          ["command", lay.ocCommands, lay.ccCommands, det.markers.oc.commands, ocToCcCommand],
          ["agent", lay.ocAgents, lay.ccAgents, det.markers.oc.agents, ocToCcAgent],
        ]
      : [
          ["command", lay.ccCommands, lay.ocCommands, det.markers.cc.commands, ccToOcCommand],
          ["agent", lay.ccAgents, lay.ocAgents, det.markers.cc.agents, ccToOcAgent],
        ];
  const done = await Promise.all(
    pair.map(([kind, source, target, files, convert]) =>
      convertMds(kind, source, target, files, root, prev, replace, convert),
    ),
  );
  return {
    planned: done.flatMap((d) => d.planned),
    warnings: done.flatMap((d) => d.warnings),
    notes: done.flatMap((d) => d.notes),
  };
}
