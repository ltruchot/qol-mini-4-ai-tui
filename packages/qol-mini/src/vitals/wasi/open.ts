import { openSync } from "node:fs";
import { BADF, NOTDIR, OK, ROFS } from "./errno.ts";
import { allocate, type Ctx, type Open } from "./fds.ts";
import { hostPath, stat, type At } from "./resolve.ts";

const WRITES = 0b1101; // O_CREAT, O_EXCL, O_TRUNC
const DIRECTORY = 0b0010;

// Read-only: a flag that would create or truncate is refused. A directory
// is kept as its host path, a file as a host descriptor opened for reading.
export function open(ctx: Ctx, [dirfd, flags, ptr, len]: At, oflags: number, fd: number): number {
  const file = hostPath(ctx, dirfd, ptr, len);
  if (file === undefined) return BADF;
  if ((oflags & WRITES) !== 0) return ROFS;
  const isDir = stat(file, flags).isDirectory();
  if (!isDir && (oflags & DIRECTORY) !== 0) return NOTDIR;
  const opened: Open = isDir
    ? { kind: "dir", host: file }
    : { kind: "file", host: openSync(file, "r"), pos: 0n };
  ctx.mem.u32(fd, allocate(ctx, opened));
  return OK;
}
