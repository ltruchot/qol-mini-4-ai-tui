// Paths the kit owns, relative to the OpenCode config dir. The plugin is
// always delivered: its features read settings.json and stay inert when off.
export const PLUGIN_DIR = "plugins/qol-mini";
export const PLUGIN_FILES = [
  `${PLUGIN_DIR}/package.json`,
  `${PLUGIN_DIR}/index.js`,
  `${PLUGIN_DIR}/tui.js`,
  `${PLUGIN_DIR}/shared.js`,
];
export const KAIZEN_COMMAND = "commands/kaizen.md";

// Emptied dirs go; one holding something of the user's stays
export const DIRS = [PLUGIN_DIR, "plugins", "commands"];
