import { readFileSync } from "node:fs";

const escape = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

// True when `disk` equals `wanted` but for the quoted interpreter path: the
// kaizen skill names `process.execPath`, which a Node upgrade moves.
export function onlyNodeDiffers(disk: string, wanted: string, node: string): boolean {
  const parts = wanted.split(`"${node}"`);
  if (parts.length < 2) return false;
  return new RegExp(`^${parts.map(escape).join(`"[^"\\r\\n]+"`)}$`, "u").test(disk);
}

// The file at `file` is what install delivers, byte for byte or but for the node path
export function delivered(file: string, wanted: Buffer | undefined, node: string): boolean {
  if (wanted === undefined) return false;
  const disk = readFileSync(file);
  return disk.equals(wanted) || onlyNodeDiffers(disk.toString(), wanted.toString(), node);
}
