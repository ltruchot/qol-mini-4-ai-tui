import { expect, test } from "vite-plus/test";
import { GREEN, hook, kit, settings } from "../helpers/kit.ts";
import { cleanup, tmpDir } from "../helpers/tmp.ts";

test("the delivered SubagentStop handler paints green, a subagent's batch does not", async () => {
  const target = await tmpDir();
  await kit(target, ["install", "--tab-state"]);
  const data = await settings(target);
  const run = async (event: string, extra: Record<string, unknown>): Promise<string> => {
    const handler = data.hooks?.[event]?.[0]?.hooks[0];
    const input = JSON.stringify({ cwd: "/tmp/demo", hook_event_name: event, ...extra });
    return (await hook(handler?.args[0] ?? "", handler?.args.slice(1) ?? [], input)).out;
  };
  const agent = { agent_id: "a1", agent_type: "Explore", stop_hook_active: false };
  expect(await run("SubagentStop", agent)).toContain(GREEN);
  expect(await run("PostToolBatch", agent)).toBe("");
  expect(await run("PostToolBatch", {})).toContain(GREEN);
  await cleanup(target);
});
