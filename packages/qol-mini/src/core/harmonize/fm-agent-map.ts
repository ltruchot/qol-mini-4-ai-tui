// Shared pieces of the agent and command frontmatter conversion
export type Fm = { data: Record<string, unknown>; lossy: string[] };

// Claude Code agent colors -> the hex OpenCode requires (`#rrggbb`)
export const COLORS: Record<string, string> = {
  red: "#e5484d",
  blue: "#0090ff",
  green: "#30a46c",
  yellow: "#ffc53d",
  purple: "#8e4ec6",
  orange: "#f76b15",
  pink: "#d6409f",
  cyan: "#00a2c7",
};

// Claude Code holds tool lists as a YAML list or a comma-separated string.
// Commas inside parentheses belong to the entry: `Agent(worker, researcher)`.
export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || value.trim() === "") return [];
  return (value.match(/[^,(]+(?:\([^)]*\))?/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

// A frontmatter value safe to interpolate: never an object
export function plain(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);
  return null;
}

// Every key outside `known`, named for the report
export const unknownKeys = (
  data: Record<string, unknown>,
  known: string[],
  side: string,
): string[] =>
  Object.keys(data)
    .filter((k) => !known.includes(k))
    .map((k) => `${k} has no ${side} form`);
