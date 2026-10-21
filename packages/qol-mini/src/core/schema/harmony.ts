import { z } from "zod";
import { SHA256 } from "./sha.ts";

// Which side the conversion reads as the source of truth
export const Side = z.enum(["claude", "opencode"]);
// How AGENTS.md relates to CLAUDE.md after a run
export const RuleMode = z.enum(["pure", "bridge", "symlink"]);
export const ArtifactKind = z.enum(["permission", "command", "agent", "mcp"]);

// One file the harmonizer generated. Rules files are not artifacts: AGENTS.md
// stays the user's file, verified by layout state, not by hash.
export const Artifact = z.object({
  kind: ArtifactKind,
  created: z.boolean(),
  hash: z.string().regex(SHA256),
  // repo-relative source path -> hash of its content at conversion time
  sources: z.record(z.string(), z.string()),
  // keys merged into a shared file: permission entries, `mcp:<name>` servers
  mine: z.array(z.string()).default([]),
  // backup slot holding the previous bytes, when the file existed
  slot: z.number().int().optional(),
});

// Executed moves in order; undo replays them backwards
export const UndoOp = z.object({
  op: z.enum(["mv", "write", "unlink", "symlink", "rmsym"]),
  path: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  slot: z.number().int().optional(),
});

export const Harmony = z.object({
  version: z.literal(1),
  from: Side,
  rules: RuleMode,
  artifacts: z.record(z.string(), Artifact),
  ops: z.array(UndoOp),
});

export type Side = z.infer<typeof Side>;
export type RuleMode = z.infer<typeof RuleMode>;
export type ArtifactKind = z.infer<typeof ArtifactKind>;
export type Artifact = z.infer<typeof Artifact>;
export type UndoOp = z.infer<typeof UndoOp>;
export type Harmony = z.infer<typeof Harmony>;
