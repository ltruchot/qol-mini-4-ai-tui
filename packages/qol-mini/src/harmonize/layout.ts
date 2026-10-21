import { join } from "node:path";
import { configAt, dirAt } from "./locate.ts";

// Where each side's files live. Which conventions a repo follows decides where
// generated files go: never a second location for what the repo already has.
export type Layout = {
  root: string;
  settings: string;
  settingsLocal: string;
  ccCommands: string;
  ccAgents: string;
  skills: string;
  mcpJson: string;
  ocConfig: string;
  ocCommands: string;
  ocAgents: string;
};

export async function layout(root: string): Promise<Layout> {
  const claude = join(root, ".claude");
  return {
    root,
    settings: join(claude, "settings.json"),
    settingsLocal: join(claude, "settings.local.json"),
    ccCommands: join(claude, "commands"),
    ccAgents: join(claude, "agents"),
    skills: join(claude, "skills"),
    mcpJson: join(root, ".mcp.json"),
    ocConfig: await configAt(root),
    ocCommands: await dirAt(root, "commands"),
    ocAgents: await dirAt(root, "agents"),
  };
}

// Repo-relative display path, backslashes flattened for Windows
export const rel = (lay: { root: string }, file: string): string =>
  file
    .slice(lay.root.length + 1)
    .split("\\")
    .join("/");
