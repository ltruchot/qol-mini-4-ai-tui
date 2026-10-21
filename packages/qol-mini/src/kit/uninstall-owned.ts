import { existsSync } from "node:fs";
import { join } from "node:path";
import { KAIZEN_SKILL, SOUNDS } from "./files.ts";
import { delivered } from "./node-path.ts";
import { kaizenSkill } from "./payloads.ts";
import { row } from "./report.ts";
import { TONES } from "./sounds.ts";

// Files a user may replace or edit: the sounds, the kaizen skill. The ones
// still holding what install delivers, to remove; the others are named, kept.
export async function ownedEditable(target: string): Promise<string[]> {
  const node = process.execPath;
  const sounds = SOUNDS.map((n): [string, Buffer | undefined] => [`sounds/${n}`, TONES[n]]);
  const all: [string, Buffer | undefined][] = [
    [KAIZEN_SKILL, await kaizenSkill(target, node)],
    ...sounds,
  ];
  const present = all.filter(([r]) => existsSync(join(target, r)));
  const ours = present.filter(([r, b]) => delivered(join(target, r), b, node)).map(([r]) => r);
  for (const [r] of present) if (!ours.includes(r)) row("kept, edited", r);
  return ours;
}
