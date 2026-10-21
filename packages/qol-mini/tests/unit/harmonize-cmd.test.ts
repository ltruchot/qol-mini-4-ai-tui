import { expect, test } from "vite-plus/test";
import { ccToOcCommand, ocToCcCommand } from "../../src/harmonize/slice-commands.ts";

test("command frontmatter keeps known keys and names the rest", () => {
  const oc = ccToOcCommand({
    description: "d",
    "argument-hint": "[env]",
    name: "deploy",
    "allowed-tools": ["Read"],
    tags: ["x"],
  });
  expect(oc.data).toStrictEqual({
    description: "d",
    "argument-hint": "[env]",
    tools: { read: true },
  });
  expect(oc.lossy).toStrictEqual(["tags has no OpenCode form"]);
  const cc = ocToCcCommand({ description: "d", tools: { read: true }, agent: "cockpit" });
  expect(cc.data).toStrictEqual({ description: "d", "allowed-tools": ["Read"] });
  expect(cc.lossy).toStrictEqual(["agent cockpit has no Claude Code form"]);
});
