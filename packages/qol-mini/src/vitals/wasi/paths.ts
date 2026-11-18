import { readlinkSync } from "node:fs";
import path from "node:path";
import { BADF, OK } from "./errno.ts";
import type { Calls, Ctx } from "./fds.ts";
import { open } from "./open.ts";
import { hostPath, stat, type At } from "./resolve.ts";
import { putStat } from "./stat.ts";

function filestat(ctx: Ctx, [dirfd, flags, ptr, len]: At, result: number): number {
  const file = hostPath(ctx, dirfd, ptr, len);
  if (file === undefined) return BADF;
  putStat(ctx.mem, result, stat(file, flags));
  return OK;
}

type Link = [dirfd: number, ptr: number, len: number, buffer: number, size: number, used: number];

// The target is written with "/" whatever the host separator
function readlink(ctx: Ctx, [dirfd, ptr, len, buffer, size, used]: Link): number {
  const file = hostPath(ctx, dirfd, ptr, len);
  if (file === undefined) return BADF;
  const target = Buffer.from(readlinkSync(file).split(path.sep).join("/"), "utf8");
  ctx.mem.put(buffer, target.subarray(0, size));
  ctx.mem.u32(used, Math.min(target.length, size));
  return OK;
}

export const pathCalls = (ctx: Ctx): Calls => ({
  path_filestat_get: (...a: [...At, number]) => filestat(ctx, [a[0], a[1], a[2], a[3]], a[4]),
  path_open: (...a: [...At, number, bigint, bigint, number, number]) =>
    open(ctx, [a[0], a[1], a[2], a[3]], a[4], a[8]),
  path_readlink: (...a: Link) => readlink(ctx, a),
});
