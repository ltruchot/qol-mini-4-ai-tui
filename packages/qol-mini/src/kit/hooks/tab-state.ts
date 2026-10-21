// Emit a terminal title carrying a state marker, for the editor's tab list.
// A hook has no terminal: Claude Code writes the sequence on its behalf,
// through the `terminalSequence` field of the hook JSON output.
//
// Usage: tab-state.js <working|blocked|idle>
import { lastText } from "./last-text.ts";
import { hookOutput } from "./marker.ts";
import { optedOut } from "./optout.ts";
import { emit, readPayload, text } from "./payload.ts";
import { parseState, resolveState } from "./tab-rules.ts";

const data = readPayload();
// idle_prompt fires a minute after Stop with no message: a question asked
// then must stay red, so read it from the transcript
const idleNote = data["hook_event_name"] === "Notification" && process.argv[2] === "idle";
if (idleNote && !("last_assistant_message" in data))
  data["last_assistant_message"] = lastText(text(data, "transcript_path"));
const cwd = text(data, "cwd");
if (!optedOut(cwd, "tab")) {
  const state = resolveState(parseState(process.argv[2]), data);
  if (state !== null) emit(hookOutput(state, cwd));
}
