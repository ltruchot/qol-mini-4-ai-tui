import type { Dirent } from "node:fs";
import type { Mem } from "./mem.ts";

export type Dir = { kind: "dir"; host: string; entries?: Dirent[] };
export type File = { kind: "file"; host: number; pos: bigint };
export type Open = Dir | File;
// Where the guest's stdout goes: the process's own, or a capture
export type Sink = { write: (data: Uint8Array) => unknown };

// What every call reads: the memory, the open descriptors, the guest's
// arguments and environment, and the host directory preopened as "/"
export type Ctx = {
  mem: Mem;
  fds: Map<number, Open>;
  args: string[];
  env: string[];
  root: string;
  out: Sink;
};

// A call the guest imports: numbers and bigints in, an errno out
export type Calls = Record<string, (...args: never[]) => number>;

export const STDIO = 3;
export const PREOPEN = 3;

type Given = Pick<Ctx, "root" | "args" | "env" | "out">;

export function context(given: Given): Omit<Ctx, "mem"> {
  return { fds: new Map<number, Open>([[PREOPEN, { kind: "dir", host: given.root }]]), ...given };
}

export function allocate(ctx: Ctx, open: Open): number {
  let fd = PREOPEN + 1;
  while (ctx.fds.has(fd)) fd += 1;
  ctx.fds.set(fd, open);
  return fd;
}

export function dirOf(ctx: Ctx, fd: number): Dir | undefined {
  const open = ctx.fds.get(fd);
  return open?.kind === "dir" ? open : undefined;
}

export function fileOf(ctx: Ctx, fd: number): File | undefined {
  const open = ctx.fds.get(fd);
  return open?.kind === "file" ? open : undefined;
}
