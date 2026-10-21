import { stringify } from "yaml";
import { parseFrontmatter } from "../schema/frontmatter.ts";

// Frontmatter back to markdown: `---` fence, YAML, blank line, body
export function withFrontmatter(data: Record<string, unknown>, body: string): string {
  const flat = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null),
  );
  const yaml = stringify(flat).trimEnd();
  const fence = yaml === "" ? "" : `---\n${yaml}\n---\n`;
  return `${fence}${body}`;
}

export function split(md: string): { data: Record<string, unknown>; body: string } {
  return parseFrontmatter(md);
}
