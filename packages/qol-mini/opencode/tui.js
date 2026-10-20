// CLI face: the tab marker and the /compact gate, the TUI counterparts of the
// tab-state and precompact-kaizen hooks. Only the session in view is painted:
// one terminal, one title. The Esc gap is shared with Claude Code — an
// interrupt fires nothing and the marker holds, session.execution.interrupted
// is deliberately not wired.
import { Plugin } from "@opencode/plugin/tui";
import { compactionPasses, configured, optedOut, writeMarker } from "./shared.js";

const HELD_TITLE = "Compaction held back";
const HELD_BODY = "This session's friction has not been reviewed.\nRun /kaizen to review it, then /compact again.";

export default Plugin.define({
  id: "qol-mini.tui",
  setup(context) {
    const { client, data, keymap, ui } = context;
    const active = () => {
      const route = ui.router.current();
      return route.type === "session" ? route.sessionID : undefined;
    };
    const dirOf = (sessionID) => data.session.get(sessionID)?.location?.directory ?? "";
    const paint = (sessionID, state) => {
      if (sessionID !== active()) return;
      const dir = dirOf(sessionID);
      if (!configured().tabs || optedOut(dir, "tab")) return;
      writeMarker(state, dir);
    };
    const still = (sessionID) =>
      paint(sessionID, data.session.status(sessionID) === "running" ? "working" : "idle");

    data.on("session.execution.started", (e) => paint(e.data.sessionID, "working"));
    data.on("session.compaction.started", (e) => paint(e.data.sessionID, "working"));
    data.on("session.execution.succeeded", (e) => paint(e.data.sessionID, "idle"));
    data.on("session.idle", (e) => paint(e.data.sessionID, "idle"));
    data.on("session.execution.failed", (e) => paint(e.data.sessionID, "blocked"));
    data.on("permission.asked", (e) => paint(e.data.sessionID, "blocked"));
    data.on("form.created", (e) => paint(e.data.form.sessionID, "blocked"));
    // A pause does not end the execution: the reply, not a new start, is
    // what resumes it — without these the red holds through the resumed run.
    data.on("permission.replied", (e) => paint(e.data.sessionID, "working"));
    data.on("form.replied", (e) => paint(e.data.sessionID, "working"));
    data.on("form.cancelled", (e) => paint(e.data.sessionID, "working"));
    // A retry with an action waits on you; one without resumes alone
    data.on("session.status", (e) => {
      const status = e.data.status;
      paint(
        e.data.sessionID,
        status.type === "idle"
          ? "idle"
          : status.type === "retry" && status.action !== undefined
            ? "blocked"
            : "working",
      );
    });
    data.on("session.viewed", (e) => still(e.data.sessionID));
    const first = active();
    if (first !== undefined) still(first);

    // The gate rides on this command because OpenCode has no PreCompact hook.
    // The built-in /compact keeps its own palette entry and is beyond a
    // plugin: chosen, it compacts ungated — the documented soft edge. This
    // entry is the one that holds back until /kaizen wrote the token.
    keymap.layer(() => ({
      mode: "global",
      priority: 100,
      commands: [
        {
          id: "qol-mini.compact",
          title: "Compact this session (kaizen-gated)",
          slash: { name: "compact", arguments: true },
          run: async () => {
            const sessionID = active();
            if (sessionID === undefined) return;
            const dir = dirOf(sessionID);
            if (configured().kaizen && !optedOut(dir, "kaizen") && !compactionPasses(dir)) {
              // The refusal speaks twice: a live session showed the toast alone
              // is easy to miss, so a modal carries the same words.
              ui.toast.show({
                title: HELD_TITLE,
                message: HELD_BODY,
                variant: "warning",
                duration: 8000,
                sessionID,
              });
              await ui.dialog.alert({ title: HELD_TITLE, message: HELD_BODY });
              return;
            }
            await client.session.compact({ sessionID });
          },
        },
      ],
    }));
  },
});
