// Two rules files where one imports the other are one set of rules, not a
// divergence: the import stands for the imported file's content at that
// place. Inlining it gives the single AGENTS.md. Claude Code expands `@path`
// imports; OpenCode does not, so it reads the importing file alone.
const importOf = (name: string): RegExp =>
  new RegExp(`(^|[\\s(])@(\\./)?${name.replace(".", String.raw`\.`)}(?=$|[\\s.,;:)])`);

export type Merged = { text: string; note: string };

// `host` with its first line naming `@guest` replaced by `guest`'s content.
// The rest of that line goes with it, named in the note.
function inline(host: string, hostName: string, guest: string, guestName: string): Merged | null {
  const lines = host.split("\n");
  const at = lines.findIndex((line) => importOf(guestName).test(line));
  if (at === -1) return null;
  const before = lines.slice(0, at);
  const pad = before.length > 0 && before.at(-1)?.trim() !== "" ? [""] : [];
  const after = lines.slice(at + 1).filter((l) => !importOf(guestName).test(l));
  const body = [...before, ...pad, guest.trimEnd(), ...after].join("\n").trimEnd();
  const line = (lines[at] ?? "").trim();
  return { text: `${body}\n`, note: `${hostName}: "${line}" replaced by ${guestName}` };
}

// One file importing the other: merged text. Both, or neither: null.
export function mergeRules(claude: string, agents: string): Merged | null {
  const agentsImports = agents.split("\n").some((l) => importOf("CLAUDE.md").test(l));
  const claudeImports = claude.split("\n").some((l) => importOf("AGENTS.md").test(l));
  if (agentsImports === claudeImports) return null;
  return agentsImports
    ? inline(agents, "AGENTS.md", claude, "CLAUDE.md")
    : inline(claude, "CLAUDE.md", agents, "AGENTS.md");
}
