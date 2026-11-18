import { closeSync, fstatSync, statSync } from "node:fs";
import { BADF, OK } from "./errno.ts";
import { STDIO, type Calls, type Ctx } from "./fds.ts";
import { CHAR, DIRECTORY, putFdstat, putStat, REGULAR } from "./stat.ts";

function fdstat(ctx: Ctx, fd: number, ptr: number): number {
  const open = ctx.fds.get(fd);
  if (open === undefined && fd >= STDIO) return BADF;
  const kinds = { dir: DIRECTORY, file: REGULAR };
  putFdstat(ctx.mem, ptr, open === undefined ? CHAR : kinds[open.kind]);
  return OK;
}

function filestat(ctx: Ctx, fd: number, ptr: number): number {
  const open = ctx.fds.get(fd);
  if (open === undefined) return BADF;
  const stat =
    open.kind === "dir"
      ? statSync(open.host, { bigint: true })
      : fstatSync(open.host, { bigint: true });
  putStat(ctx.mem, ptr, stat);
  return OK;
}

function close(ctx: Ctx, fd: number): number {
  const open = ctx.fds.get(fd);
  if (open?.kind === "file") closeSync(open.host);
  return fd < STDIO || ctx.fds.delete(fd) ? OK : BADF;
}

export const metaCalls = (ctx: Ctx): Calls => ({
  fd_close: (fd: number) => close(ctx, fd),
  fd_fdstat_get: (fd: number, ptr: number) => fdstat(ctx, fd, ptr),
  fd_filestat_get: (fd: number, ptr: number) => filestat(ctx, fd, ptr),
});
