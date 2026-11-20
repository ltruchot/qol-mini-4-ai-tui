import { fstatSync, readSync } from "node:fs";
import { BADF, INVAL, OK } from "./errno.ts";
import { fileOf, type Calls, type Ctx, type File } from "./fds.ts";

// Fill the buffers in order; a short read ends the call
function fill(file: File, buffers: Uint8Array[]): number {
  let total = 0;
  for (const buffer of buffers) {
    const got = readSync(file.host, buffer, { position: file.pos });
    file.pos += BigInt(got);
    total += got;
    if (got < buffer.length) break;
  }
  return total;
}

function read(ctx: Ctx, fd: number, iovs: number, count: number, nread: number): number {
  const file = fileOf(ctx, fd);
  if (file === undefined && fd !== 0) return BADF;
  ctx.mem.u32(nread, file === undefined ? 0 : fill(file, ctx.mem.iovecs(iovs, count)));
  return OK;
}

function write(ctx: Ctx, fd: number, iovs: number, count: number, nwritten: number): number {
  const stream = [undefined, ctx.out, process.stderr][fd];
  if (stream === undefined) return BADF;
  const data = Buffer.concat(ctx.mem.iovecs(iovs, count));
  stream.write(data);
  ctx.mem.u32(nwritten, data.length);
  return OK;
}

function seek(ctx: Ctx, fd: number, offset: bigint, whence: number, result: number): number {
  const file = fileOf(ctx, fd);
  if (file === undefined) return BADF;
  const base = [0n, file.pos, fstatSync(file.host, { bigint: true }).size][whence];
  if (base === undefined || base + offset < 0n) return INVAL;
  file.pos = base + offset;
  ctx.mem.u64(result, file.pos);
  return OK;
}

export const fileCalls = (ctx: Ctx): Calls => ({
  fd_read: (...a: [number, number, number, number]) => read(ctx, ...a),
  fd_write: (...a: [number, number, number, number]) => write(ctx, ...a),
  fd_seek: (...a: [number, bigint, number, number]) => seek(ctx, ...a),
});
