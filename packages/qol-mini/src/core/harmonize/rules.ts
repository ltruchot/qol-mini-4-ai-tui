// Which of the four AGENTS.md/CLAUDE.md layouts a repo holds. Symlink targets
// name the other file: `amp` links CLAUDE.md -> AGENTS.md, `legacy` the reverse.
export type FileKind = "absent" | "file" | "symlink";
export type RulesState =
  | "none"
  | "pure" // AGENTS.md alone
  | "claude-only" // CLAUDE.md alone
  | "bridge" // AGENTS.md + CLAUDE.md holding only `@AGENTS.md`
  | "amp" // AGENTS.md + CLAUDE.md -> AGENTS.md
  | "legacy" // CLAUDE.md + AGENTS.md -> CLAUDE.md
  | "diverged" // two real files with different content
  | "broken"; // a symlink to elsewhere, or a loop

export type RulesInfo = {
  claude: FileKind;
  claudeTarget?: string | undefined;
  bridge: boolean;
  agents: FileKind;
  agentsTarget?: string | undefined;
};

const targets = (info: RulesInfo, kind: keyof RulesInfo): string | undefined =>
  kind === "claude" ? info.claudeTarget : info.agentsTarget;

export function rulesState(info: RulesInfo): RulesState {
  const { claude, agents, bridge } = info;
  if (claude === "absent" && agents === "absent") return "none";
  if (claude === "absent") return agents === "symlink" ? "broken" : "pure";
  if (agents === "absent") return claude === "symlink" ? "broken" : "claude-only";
  if (claude === "symlink")
    return targets(info, "claude") === "AGENTS.md" && agents !== "symlink" ? "amp" : "broken";
  if (agents === "symlink") return targets(info, "agents") === "CLAUDE.md" ? "legacy" : "broken";
  return bridge ? "bridge" : "diverged";
}

// CLAUDE.md that only imports AGENTS.md: the `bridge` rules mode
export function isBridge(content: string): boolean {
  return content.trim() === "@AGENTS.md";
}

// What the bridge file holds
export const BRIDGE_IMPORT = "@AGENTS.md\n";
