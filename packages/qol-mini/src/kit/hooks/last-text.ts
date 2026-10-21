import { type Payload, record, text } from "./payload.ts";
import { tail } from "./tail.ts";

const THINKING = new Set(["thinking", "redacted_thinking"]);

// The text of one transcript entry when it is a main-thread assistant
// message, else undefined. Sidechain entries are subagents; each content
// block is its own entry, and a thinking block is not what was said.
function textOf(entry: Payload): string | undefined {
  if (entry["type"] !== "assistant" || entry["isSidechain"] === true) return undefined;
  const content = record(entry, "message")["content"];
  if (!Array.isArray(content)) return undefined;
  if (content.every((block: Payload) => THINKING.has(String(block["type"])))) return undefined;
  return content
    .map((block: Payload) => (block["type"] === "text" ? text(block, "text") : ""))
    .join("\n");
}

// The newest main-thread assistant message, from the transcript: the events
// that fire after a turn ends without `last_assistant_message` (idle_prompt)
// still need to know whether it ended on a question.
export function lastText(path: string): string {
  if (path === "") return "";
  try {
    for (const line of tail(path).split("\n").toReversed()) {
      try {
        const found = textOf(JSON.parse(line) as Payload);
        if (found !== undefined) return found;
      } catch {
        // not a JSON line
      }
    }
  } catch {
    // no transcript
  }
  return "";
}
