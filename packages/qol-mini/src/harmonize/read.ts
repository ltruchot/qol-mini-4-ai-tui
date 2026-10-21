import { readFile } from "node:fs/promises";
import { hashBytes } from "../core/hash/file.ts";
import { exists } from "../io/fs.ts";
import { parseJsonc } from "../io/jsonc.ts";

export type Json = Record<string, unknown>;
// A source file: absent, unparseable (named, never written over), or loaded
export type JsonResult =
  | { state: "absent" }
  | { state: "bad"; error: string }
  | { state: "ok"; data: Json; hash: string; text: string };

export async function readJson(file: string): Promise<JsonResult> {
  if (!(await exists(file))) return { state: "absent" };
  const text = await readFile(file, "utf8");
  const parsed = parseJsonc(text);
  if ("error" in parsed) return { state: "bad", error: parsed.error };
  const { data } = parsed;
  if (data === null || typeof data !== "object" || Array.isArray(data))
    return { state: "bad", error: "not a JSON object" };
  return { state: "ok", data: data as Json, hash: hashBytes(Buffer.from(text)), text };
}

export async function readText(file: string): Promise<string | null> {
  if (!(await exists(file))) return null;
  return readFile(file, "utf8");
}
