import type { ArtifactKind, Side, RuleMode } from "../core/schema/harmony.ts";
import type { RulesState } from "../core/harmonize/rules.ts";

// A rule move the plan wants: `mv` renames, `unlink` removes whatever sits at
// `path` (apply records whether it was a symlink), `symlink` links path -> to,
// `write` lays down the `@AGENTS.md` bridge.
// `write` with no `content` lays down the bridge; with it, the merged rules
export type Intent = {
  op: "mv" | "unlink" | "symlink" | "write";
  path: string;
  to?: string;
  content?: string;
};

// One generated file: the harmonizer owns its bytes, `mine` holds the keys it
// merged into a shared file, `sources` the files it was converted from
export type Planned = {
  kind: ArtifactKind;
  file: string;
  rel: string;
  bytes: Buffer;
  sources: Record<string, string>;
  mine: string[];
};

export type Plan = {
  from: Side;
  rulesMode: RuleMode;
  state: RulesState;
  intents: Intent[];
  files: Planned[];
  warnings: string[];
  notes: string[];
  conflicts: string[];
};

// The parts of a run `--only` selects
export const SLICES = ["rules", "perm", "mcp", "commands", "agents"] as const;
export type Slice = (typeof SLICES)[number];

// Validated options: `auto` detects the source of truth again, no `only`
// selects every slice
export type PlanOpts = {
  from?: Side | "auto" | undefined;
  rules?: RuleMode | undefined;
  replace: boolean;
  only?: Slice[] | undefined;
};
