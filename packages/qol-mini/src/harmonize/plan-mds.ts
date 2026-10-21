import { ccToOcAgent } from "../core/harmonize/fm-agent.ts";
import { guardsOf } from "../core/harmonize/perm-guards.ts";
import { ocToCcAgent } from "../core/harmonize/fm-agent-oc.ts";
import type { Artifact, Side } from "../core/schema/harmony.ts";
import type { Detect } from "./detect.ts";
import type { Layout } from "./layout.ts";
import type { Planned } from "./plan-types.ts";
import { ccToOcCommand, ocToCcCommand } from "./slice-commands.ts";
import { convertMds } from "./slice-md.ts";
import type { Convert } from "./slice-one.ts";
import { readJson } from "./read.ts";

export type MdsOut = { planned: Planned[]; warnings: string[]; notes: string[] };
type Kind = "command" | "agent";

// Commands and agents of the source of truth, one guarded file per source
export async function convertBoth(
  from: Side,
  lay: Layout,
  det: Detect,
  root: string,
  prev: Record<string, Artifact>,
  replace: boolean,
): Promise<MdsOut> {
  const read = await readJson(lay.settings);
  const guards = guardsOf(read.state === "ok" ? read.data : undefined);
  const toOcAgent: Convert = (data, stem) => ccToOcAgent(data, stem, guards);
  const pair: [Kind, string, string, string[], Convert][] =
    from === "opencode"
      ? [
          ["command", lay.ocCommands, lay.ccCommands, det.markers.oc.commands, ocToCcCommand],
          ["agent", lay.ocAgents, lay.ccAgents, det.markers.oc.agents, ocToCcAgent],
        ]
      : [
          ["command", lay.ccCommands, lay.ocCommands, det.markers.cc.commands, ccToOcCommand],
          ["agent", lay.ccAgents, lay.ocAgents, det.markers.cc.agents, toOcAgent],
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
