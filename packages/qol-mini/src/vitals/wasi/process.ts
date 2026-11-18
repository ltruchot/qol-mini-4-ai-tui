import { randomFillSync } from "node:crypto";
import { ExitError, OK } from "./errno.ts";
import type { Calls, Ctx } from "./fds.ts";

const encode = (list: string[]): Uint8Array[] => list.map((s) => Buffer.from(`${s}\0`, "utf8"));

function sizes(ctx: Ctx, list: string[], count: number, size: number): number {
  ctx.mem.u32(count, list.length);
  ctx.mem.u32(
    size,
    encode(list).reduce((sum, item) => sum + item.length, 0),
  );
  return OK;
}

// A string list: an array of pointers, then the null-terminated strings
function strings(ctx: Ctx, list: string[], pointers: number, buffer: number): number {
  let at = buffer;
  for (const [i, item] of encode(list).entries()) {
    ctx.mem.u32(pointers + i * 4, at);
    ctx.mem.put(at, item);
    at += item.length;
  }
  return OK;
}

export const processCalls = (ctx: Ctx): Calls => ({
  args_sizes_get: (count: number, size: number) => sizes(ctx, ctx.args, count, size),
  args_get: (pointers: number, buffer: number) => strings(ctx, ctx.args, pointers, buffer),
  environ_sizes_get: (count: number, size: number) => sizes(ctx, ctx.env, count, size),
  environ_get: (pointers: number, buffer: number) => strings(ctx, ctx.env, pointers, buffer),
  random_get: (ptr: number, len: number) => {
    randomFillSync(ctx.mem.bytes, ptr, len);
    return OK;
  },
  proc_exit: (status: number) => {
    throw new ExitError(status);
  },
});
