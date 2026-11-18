import { BADF, OK } from "./errno.ts";
import { PREOPEN, type Calls, type Ctx } from "./fds.ts";

const NAME = Buffer.from("/", "utf8");

// One preopened directory, named "/". prestat: tag 0 (a directory), then the
// length of that name.
export const preopenCalls = (ctx: Ctx): Calls => ({
  fd_prestat_get: (fd: number, ptr: number) => {
    if (fd !== PREOPEN) return BADF;
    ctx.mem.put(ptr, Buffer.from([0, 0, 0, 0, NAME.length, 0, 0, 0]));
    return OK;
  },
  fd_prestat_dir_name: (fd: number, ptr: number) => {
    if (fd === PREOPEN) ctx.mem.put(ptr, NAME);
    return fd === PREOPEN ? OK : BADF;
  },
});
