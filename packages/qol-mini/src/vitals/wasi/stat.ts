import type { BigIntStats } from "node:fs";
import type { Mem } from "./mem.ts";

export const CHAR = 2;
export const DIRECTORY = 3;
export const REGULAR = 4;
export const SYMLINK = 7;

type Kind = { isDirectory: () => boolean; isFile: () => boolean; isSymbolicLink: () => boolean };

export function filetype(kind: Kind): number {
  if (kind.isDirectory()) return DIRECTORY;
  if (kind.isFile()) return REGULAR;
  return kind.isSymbolicLink() ? SYMLINK : 0;
}

const FILESTAT = 64;

// filestat: dev, ino, filetype, nlink, size, atim, mtim, ctim
export function putStat(mem: Mem, ptr: number, stat: BigIntStats): void {
  mem.put(ptr, new Uint8Array(FILESTAT));
  mem.u64(ptr, stat.dev);
  mem.u64(ptr + 8, stat.ino);
  mem.u8(ptr + 16, filetype(stat));
  mem.u64(ptr + 24, stat.nlink);
  mem.u64(ptr + 32, stat.size);
  mem.u64(ptr + 40, stat.atimeNs);
  mem.u64(ptr + 48, stat.mtimeNs);
  mem.u64(ptr + 56, stat.ctimeNs);
}

const FDSTAT = 24;
const ALL_RIGHTS = 0xff_ff_ff_ff_ff_ff_ff_ffn;

// fdstat: filetype, flags, rights, inheriting rights
export function putFdstat(mem: Mem, ptr: number, type: number): void {
  mem.put(ptr, new Uint8Array(FDSTAT));
  mem.u8(ptr, type);
  mem.u64(ptr + 8, ALL_RIGHTS);
  mem.u64(ptr + 16, ALL_RIGHTS);
}
