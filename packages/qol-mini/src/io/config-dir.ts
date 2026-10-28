import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

// CLAUDE_CONFIG_DIR when set and non-empty, else ~/.claude
export function configDir(env: Record<string, string | undefined> = process.env): string {
  const set = env["CLAUDE_CONFIG_DIR"] ?? "";
  return set === "" ? join(homedir(), ".claude") : set;
}

// The config dir when it is not ~/.claude, home shortened to ~, control
// characters stripped; empty for the standard one
export function customConfigDir(
  env: Record<string, string | undefined> = process.env,
  home = homedir(),
): string {
  const set = env["CLAUDE_CONFIG_DIR"] ?? "";
  const dir = resolve(set).replaceAll(/\p{Cc}/gu, "");
  if (set === "" || dir === resolve(home, ".claude")) return "";
  return dir.startsWith(`${home}${sep}`) ? `~${dir.slice(home.length)}` : dir;
}
