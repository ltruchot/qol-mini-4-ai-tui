// Shared by both plugin faces. `@opencode/plugin` is resolved by OpenCode at
// runtime: this directory ships as-is, no build, no dependency. Every rule
// mirrors a Claude Code hook in src/kit/hooks: the same state files, the same
// marker bytes, the same opt-out walk, so one review releases both agents.
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

export const OPTOUT_FILE = join(".claude", "qol-mini-off");

// CLAUDE_CONFIG_DIR when set, else ~/.claude: where the installer wired the
// features, and where the kaizen tokens live.
export function claudeDir() {
  const set = process.env.CLAUDE_CONFIG_DIR ?? "";
  return set === "" ? join(homedir(), ".claude") : set;
}

// The feature set as the installer wired it in settings.json: one source of
// truth for both agents. With nothing of ours there, everything is off.
export function configured() {
  try {
    const data = JSON.parse(readFileSync(join(claudeDir(), "settings.json"), "utf8"));
    const ours = JSON.stringify(data.hooks ?? {}).replaceAll("\\\\", "/");
    return {
      tabs: ours.includes("hooks/tab-state."),
      kaizen: ours.includes("hooks/precompact-kaizen."),
    };
  } catch {
    return { tabs: false, kaizen: false };
  }
}

// The nearest opt-out file at `dir` or above it, or null. The walk stops below
// the home directory: a stray file there silences nothing.
function optoutText(dir, home) {
  let at = realpathSync(dir === "" ? process.cwd() : dir);
  const stop = realpathSync(home);
  for (;;) {
    const parent = dirname(at);
    if (at === stop || parent === at) return null;
    try {
      return readFileSync(join(at, OPTOUT_FILE), "utf8");
    } catch {
      at = parent;
    }
  }
}

// An empty file switches every feature off. A file that names features switches
// off those only: kaizen, tab, sounds, split on spaces or commas.
export function optedOut(cwd, feature) {
  try {
    const listed = optoutText(cwd, homedir())
      ?.split(/[\s,]+/u)
      .filter((word) => word !== "");
    return listed !== undefined && (listed.length === 0 || listed.includes(feature));
  } catch {
    return false;
  }
}

// One token per working directory, not per session: the skill writes it from a
// plain shell, and one project's review does not release another's.
export function tokenFor(cwd) {
  let path;
  try {
    path = realpathSync(cwd);
  } catch {
    path = resolve(cwd);
  }
  const slug = basename(path).replaceAll(/[^A-Za-z0-9._-]/g, "-");
  const digest = createHash("sha1").update(path).digest("hex").slice(0, 8);
  return join(claudeDir(), "state", `kaizen-${slug === "" ? "root" : slug}-${digest}.done`);
}

// True when the compaction goes through. A recorded review is honored and its
// token consumed, so the next /compact here is reviewed too. A state directory
// that cannot be managed must not make /compact unusable.
export function compactionPasses(cwd) {
  try {
    mkdirSync(join(claudeDir(), "state"), { recursive: true });
    const token = tokenFor(cwd);
    if (!existsSync(token)) return false;
    unlinkSync(token);
    return true;
  } catch {
    return true;
  }
}

// Several copies of this file can be live at once, and each copy sees the
// same compaction event. The first copy to create the event's marker sends
// the one reminder; the others stay silent. A state directory that cannot
// be managed fails open: a duplicate reminder beats silence.
export function oncePerEvent(eventID) {
  try {
    const dir = join(claudeDir(), "state");
    mkdirSync(dir, { recursive: true });
    const now = Date.now();
    for (const name of readdirSync(dir)) {
      if (!name.startsWith("remind-")) continue;
      try {
        const file = join(dir, name);
        if (now - statSync(file).mtimeMs > 3_600_000) unlinkSync(file);
      } catch {
        // a sweep race between copies never stops the claim
      }
    }
    closeSync(openSync(join(dir, `remind-${eventID.replaceAll(/[^A-Za-z0-9._-]/g, "-")}`), "wx"));
    return true;
  } catch (error) {
    return error?.code !== "EEXIST";
  }
}

// CC_TAB_WORKING, CC_TAB_BLOCKED and CC_TAB_IDLE override each marker; an empty
// value drops it.
function markers() {
  return {
    working: process.env.CC_TAB_WORKING ?? "\u{1F7E2}",
    blocked: process.env.CC_TAB_BLOCKED ?? "\u{1F534}",
    idle: process.env.CC_TAB_IDLE ?? "\u{1F7E1}",
  };
}

// The tab title the editor reads through ${sequence}. Control characters are
// stripped: a byte outside the title breaks the sequence. The TUI owns the
// screen; /dev/tty is the only way out to the terminal's title. The title
// ends in ST, not BEL: the raw write races the TUI's redraw, and a BEL met
// outside a parsed title rings — ST never does.
export function writeMarker(state, cwd) {
  try {
    const dir = cwd === "" ? process.cwd() : cwd;
    const label = basename(dir).replaceAll(/\p{Cc}/gu, "");
    const title = `${markers()[state]} ${label}`.trim();
    const tty = openSync("/dev/tty", "w");
    writeSync(tty, `\u001B]0;${title}\u001B\\`);
    closeSync(tty);
  } catch {
    // no /dev/tty (Windows), or a directory that no longer resolves
  }
}
