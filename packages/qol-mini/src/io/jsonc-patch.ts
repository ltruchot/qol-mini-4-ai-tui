import { applyEdits, modify } from "jsonc-parser";

type Json = Record<string, unknown>;
type Path = (string | number)[];

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// The indent the file already uses: the first indented line, two spaces else
function indentOf(text: string): { insertSpaces: boolean; tabSize: number } {
  const match = /\n([ \t]+)\S/.exec(text);
  const lead = match?.[1] ?? "  ";
  return lead.startsWith("\t")
    ? { insertSpaces: false, tabSize: 1 }
    : { insertSpaces: true, tabSize: lead.length };
}

// Edits from `before` to `after`, value by value: untouched keys keep their
// place, comments and formatting; a new key lands at the end of its object.
function edits(before: unknown, after: unknown, path: Path, out: [Path, unknown][]): void {
  if (isObject(before) && isObject(after)) {
    for (const key of Object.keys(before))
      if (!(key in after)) out.push([[...path, key], undefined]);
    for (const [key, value] of Object.entries(after))
      if (key in before) {
        edits(before[key], value, [...path, key], out);
      } else {
        out.push([[...path, key], value]);
      }
    return;
  }
  if (!same(before, after)) out.push([path, after]);
}

export function patchJsonc(text: string, before: Json, after: Json): string {
  const changes: [Path, unknown][] = [];
  edits(before, after, [], changes);
  const formattingOptions = { ...indentOf(text), eol: text.includes("\r\n") ? "\r\n" : "\n" };
  let out = text;
  for (const [path, value] of changes)
    out = applyEdits(out, modify(out, path, value, { formattingOptions }));
  return out;
}
