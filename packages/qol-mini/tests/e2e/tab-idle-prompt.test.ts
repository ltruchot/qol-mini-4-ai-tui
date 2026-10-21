import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { RED, YELLOW, hook } from "../helpers/kit.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

// One transcript entry per content block, as Claude Code writes them
const said = (blocks: object[], sidechain = false): string =>
  JSON.stringify({ type: "assistant", isSidechain: sidechain, message: { content: blocks } });

async function idlePrompt(dir: string, entries: string[]): Promise<string> {
  const transcript = join(dir, "t.jsonl");
  await writeFile(transcript, `${entries.join("\n")}\n`);
  const input = {
    cwd: "/tmp/demo",
    hook_event_name: "Notification",
    notification_type: "idle_prompt",
    transcript_path: transcript,
  };
  return (await hook("tab-state", ["idle"], JSON.stringify(input))).out;
}

test("idle_prompt keeps red on a turn that ended on a question", async () => {
  const dir = await tmpDir();
  const question = said([{ type: "text", text: "Done.\n\n**Shall I push?**" }]);
  const subagent = said([{ type: "text", text: "Report." }], true);
  const thinking = said([{ type: "thinking", thinking: "x" }]);
  expect(await idlePrompt(dir, [thinking, question, subagent])).toContain(RED);
  const answer = said([{ type: "text", text: "Pushed." }]);
  expect(await idlePrompt(dir, [question, answer])).toContain(YELLOW);
  expect(await idlePrompt(dir, [])).toContain(YELLOW);
  await cleanup(dir);
});
