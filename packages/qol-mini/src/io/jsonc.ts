import { parse, type ParseError } from "jsonc-parser";

type Json = Record<string, unknown>;

// JSON with comments and trailing commas, the way OpenCode reads its config
export function parseJsonc(text: string): { data: unknown } | { error: string } {
  const errors: ParseError[] = [];
  const data: unknown = parse(text, errors, { allowTrailingComma: true });
  const first = errors[0];
  return first === undefined
    ? { data }
    : { error: `JSONC error ${first.error} at ${first.offset}` };
}

// A file the kit creates: insertion order, two spaces, a final newline
export const freshJson = (data: Json): string => `${JSON.stringify(data, null, 2)}\n`;
