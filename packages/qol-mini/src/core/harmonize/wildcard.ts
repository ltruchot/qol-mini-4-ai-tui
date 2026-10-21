// OpenCode's permission matcher (src/util/wildcard.ts, OpenCode 2.1): `*` is
// any run of characters, `/` included, `?` one character, and a trailing ` *`
// makes the arguments optional, so `git *` also matches `git`.
export function matches(input: string, pattern: string): boolean {
  let escaped = pattern
    .replaceAll("\\", "/")
    .replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
    .replaceAll("*", ".*")
    .replaceAll("?", ".");
  if (escaped.endsWith(" .*")) escaped = `${escaped.slice(0, -3)}( .*)?`;
  return new RegExp(`^${escaped}$`, "s").test(input.replaceAll("\\", "/"));
}

const RANK = { allow: 0, ask: 1, deny: 2 } as const;
export type Effect = keyof typeof RANK;

// Claude Code's order of precedence, deny over ask over allow, as a number
export const strictness = (effect: Effect): number => RANK[effect];
