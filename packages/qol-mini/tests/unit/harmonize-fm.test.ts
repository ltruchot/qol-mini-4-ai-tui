import { expect, test } from "vite-plus/test";
import { ccToOcAgent } from "../../src/core/harmonize/fm-agent.ts";
import { ocToCcAgent } from "../../src/core/harmonize/fm-agent-oc.ts";

test("an agent allowlist stays an allowlist in OpenCode", () => {
  const oc = ccToOcAgent(
    { name: "rev", description: "d", tools: "Read, Bash(git:*)", disallowedTools: ["Bash(rm *)"] },
    "rev",
  );
  expect(oc.data["permissions"]).toStrictEqual([
    { action: "*", resource: "*", effect: "deny" },
    { action: "read", resource: "*", effect: "allow" },
    { action: "shell", resource: "git *", effect: "allow" },
    { action: "shell", resource: "*", effect: "deny" },
  ]);
  expect(oc.lossy).toStrictEqual([]);
});

test("agent fields map or are named, never dropped", () => {
  const data = {
    name: "x",
    description: "d",
    model: "opus",
    maxTurns: 5,
    color: "cyan",
    memory: "user",
  };
  const oc = ccToOcAgent(data, "y");
  expect(oc.data).toStrictEqual({
    description: "d",
    mode: "subagent",
    model: "anthropic/claude-opus-5-5",
    steps: 5,
    color: "#00a2c7",
  });
  expect(oc.lossy).toStrictEqual(["memory has no OpenCode form", "name x: OpenCode names it y"]);
  const back = ocToCcAgent({ ...oc.data, permission: { "*": "deny", read: "allow" } }, "y");
  expect(back?.data).toStrictEqual({
    name: "y",
    description: "d",
    tools: ["Read"],
    model: "opus",
    maxTurns: 5,
    color: "cyan",
  });
  expect(ocToCcAgent({ description: "d", disable: true }, "z")).toBeNull();
});
