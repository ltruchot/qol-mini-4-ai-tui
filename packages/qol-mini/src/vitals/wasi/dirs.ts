import { readdirSync, type Dirent } from "node:fs";
import { BADF, OK } from "./errno.ts";
import { dirOf, type Calls, type Ctx } from "./fds.ts";
import { filetype } from "./stat.ts";

const DIRENT = 24;

// dirent: next cookie, inode, name length, type, then the name
function record(entry: Dirent, next: number): Buffer {
  const name = Buffer.from(entry.name, "utf8");
  const bytes = Buffer.alloc(DIRENT + name.length);
  bytes.writeBigUInt64LE(BigInt(next), 0);
  bytes.writeUInt32LE(name.length, 16);
  bytes.writeUInt8(filetype(entry), 20);
  bytes.set(name, DIRENT);
  return bytes;
}

type Listing = [fd: number, ptr: number, len: number, cookie: bigint, used: number];

// The listing is read once per descriptor, so a cookie keeps its meaning
// across calls; the last record is cut where the buffer ends, which is how
// the guest learns to call again.
function readdir(ctx: Ctx, [fd, ptr, len, cookie, used]: Listing): number {
  const dir = dirOf(ctx, fd);
  if (dir === undefined) return BADF;
  dir.entries ??= readdirSync(dir.host, { withFileTypes: true });
  let at = 0;
  for (const [i, entry] of dir.entries.entries()) {
    if (i < Number(cookie)) continue;
    if (at >= len) break;
    const bytes = record(entry, i + 1).subarray(0, len - at);
    ctx.mem.put(ptr + at, bytes);
    at += bytes.length;
  }
  ctx.mem.u32(used, at);
  return OK;
}

export const dirCalls = (ctx: Ctx): Calls => ({
  fd_readdir: (...a: Listing) => readdir(ctx, a),
});
