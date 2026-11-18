import { lstatSync, statSync, type BigIntStats } from "node:fs";
import path from "node:path";
import { dirOf, type Ctx } from "./fds.ts";

const FOLLOW = 1;

export type At = [dirfd: number, flags: number, ptr: number, len: number];

// A guest path is relative to an open directory; the host resolves the rest
export function hostPath(ctx: Ctx, dirfd: number, ptr: number, len: number): string | undefined {
  const dir = dirOf(ctx, dirfd);
  return dir === undefined ? undefined : path.join(dir.host, ctx.mem.text(ptr, len));
}

export function stat(file: string, flags: number): BigIntStats {
  return ((flags & FOLLOW) === FOLLOW ? statSync : lstatSync)(file, { bigint: true });
}
