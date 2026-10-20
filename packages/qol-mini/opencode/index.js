// Server face: after a compaction the session continues from a summary, and
// the next prompt builds on nothing. Name TODO.md, the same message the
// Claude Code SessionStart hook injects, as a synthetic message.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Plugin } from "@opencode/plugin";
import { configured, optedOut } from "./shared.js";

function todoFile(dir) {
  try {
    const name = readdirSync(dir)
      .toSorted()
      .find((entry) => entry.toLowerCase() === "todo.md" && statSync(join(dir, entry)).isFile());
    return name === undefined ? undefined : join(dir, name);
  } catch {
    return undefined;
  }
}

function reminder(dir) {
  const todo = todoFile(dir);
  if (todo === undefined) return undefined;
  try {
    if (readFileSync(todo, "utf8").trim() === "") return undefined;
    return (
      `Compaction done. Read ${todo} first: where this session stopped, and ` +
      "what is left. Open a todo/ file only for the item you work on."
    );
  } catch {
    return undefined;
  }
}

export default Plugin.define({
  id: "qol-mini",
  async setup(ctx) {
    const controller = new AbortController();
    void (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        try {
          if (event.type !== "session.compaction.ended") continue;
          const dir = event.location?.directory ?? "";
          if (dir === "" || !configured().kaizen || optedOut(dir, "kaizen")) continue;
          const text = reminder(dir);
          if (text !== undefined)
            await ctx.session.synthetic({ sessionID: event.data.sessionID, text });
        } catch {
          // one unreadable event never stops the stream
        }
      }
    })();
    return () => controller.abort();
  },
});
