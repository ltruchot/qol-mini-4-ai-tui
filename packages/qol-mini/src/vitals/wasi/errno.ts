// WASI preview1 errno values the host returns
export const OK = 0;
export const BADF = 8;
export const INVAL = 28;
export const IO = 29;
export const NOTDIR = 54;
export const ROFS = 69;

const BY_CODE: Record<string, number> = {
  EACCES: 2,
  EBADF: BADF,
  EINVAL: INVAL,
  EISDIR: 31,
  ELOOP: 32,
  ENAMETOOLONG: 37,
  ENOENT: 44,
  ENOTDIR: NOTDIR,
  EPERM: 63,
};

// The exit status the guest asked for, carried out of the module by a throw
export class ExitError extends Error {
  public readonly status: number;
  public constructor(status: number) {
    super(`exit ${status}`);
    this.name = "ExitError";
    this.status = status;
  }
}

// Run one call: a host filesystem error becomes its errno, an exit passes
export function guard(call: () => number): number {
  try {
    return call();
  } catch (error) {
    if (error instanceof ExitError) throw error;
    return BY_CODE[(error as NodeJS.ErrnoException).code ?? ""] ?? IO;
  }
}
