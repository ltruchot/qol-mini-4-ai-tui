import { expect, test } from "vite-plus/test";
import { ccToOcCommand, ocToCcCommand } from "../../src/harmonize/slice-commands.ts";

test("command frontmatter keeps what OpenCode reads and names the rest", () => {
  const oc = ccToOcCommand({
    description: "d",
    "argument-hint": "[env]",
    name: "deploy",
    "allowed-tools": ["Read"],
  });
  expect(oc.data).toStrictEqual({ description: "d" });
  expect(oc.lossy).toStrictEqual([
    "argument-hint has no OpenCode form",
    "allowed-tools has no OpenCode form",
  ]);
  const cc = ocToCcCommand({ description: "d", agent: "cockpit" });
  expect(cc.data).toStrictEqual({ description: "d" });
  expect(cc.lossy).toStrictEqual(["agent cockpit: Claude Code runs it inline"]);
});
