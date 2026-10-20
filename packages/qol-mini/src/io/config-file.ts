import { readFileSync } from "node:fs";
import { fail } from "./ui.ts";

// A config file as an object: {} when missing or empty, a loud failure when
// the JSON is corrupt — never a silent default over a file the user wrote.
export function readConfig(file: string): Record<string, unknown> {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return {};
  }
  try {
    return JSON.parse(raw.trim() === "" ? "{}" : raw) as Record<string, unknown>;
  } catch {
    return fail(`${file} is not valid JSON. Fix or move it, then re-run.`);
  }
}
