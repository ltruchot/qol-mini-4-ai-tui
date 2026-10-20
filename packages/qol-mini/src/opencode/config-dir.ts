import { homedir } from "node:os";
import { join } from "node:path";

// The OpenCode global config dir, resolved as OpenCode resolves it:
// $XDG_CONFIG_HOME/opencode when set, else ~/.config/opencode
export function opencodeDir(env: Record<string, string | undefined> = process.env): string {
  const xdg = env["XDG_CONFIG_HOME"] ?? "";
  return join(xdg === "" ? join(homedir(), ".config") : xdg, "opencode");
}
