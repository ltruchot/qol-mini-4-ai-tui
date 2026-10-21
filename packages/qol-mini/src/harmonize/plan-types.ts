import type { ArtifactKind, Side, RuleMode } from "../core/schema/harmony.ts";
import type { RulesState } from "../core/harmonize/rules.ts";

// A rule move the plan wants: `mv` renames, `unlink` removes whatever sits at
// `path` (apply records whether it was a symlink), `symlink` links path -> to,
// `write` lays down the `@AGENTS.md` bridge.
export type Intent = { op: "mv" | "unlink" | "symlink" | "write"; path: string; to?: string };

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
