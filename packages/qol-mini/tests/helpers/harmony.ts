import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { main } from "../../src/app.ts";
import { capture } from "./capture.ts";
import type { Run } from "./cli.ts";
import { tmpDir } from "./tmp.ts";

// Run `qol-mini harmonize` in-process, with the config dir, the cache and the
// store pointed at the throwaway project: no test touches the real ones.
export async function harm(
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<Run> {
  const scoped = {
    XDG_CACHE_HOME: join(cwd, ".cache"),
    CLAUDE_CONFIG_DIR: join(cwd, ".home"),
    ...env,
  };
  const run = await capture(scoped, () =>
    main(["node", "qol-mini", "harmonize", ...args, "--cwd", cwd]),
  );
  return { code: run.value, out: run.out };
}

// A throwaway git repo holding exactly these files
export async function repo(files: Record<string, string>): Promise<string> {
  const dir = await tmpDir("qol-mini-harmony-");
  await mkdir(join(dir, ".git"));
  await put(dir, files);
  return dir;
}

export async function put(dir: string, files: Record<string, string>): Promise<void> {
  for (const [name, text] of Object.entries(files)) {
    const file = join(dir, name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
  }
}
