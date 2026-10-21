import { expect, test } from "vite-plus/test";
import { ccToOcTools } from "../../src/core/harmonize/fm-tools.ts";
import { ocToCcTools } from "../../src/core/harmonize/fm-tools-oc.ts";
import { ccToOcAgent } from "../../src/core/harmonize/fm-agent.ts";
import { ocToCcAgent } from "../../src/core/harmonize/fm-agent-oc.ts";
import { toCcModel, toOcModel } from "../../src/core/harmonize/model.ts";

test("command tools convert both ways, lossy named", () => {
  expect(ccToOcTools(["Read", "Bash(git:*)", "Task"])).toStrictEqual({
    tools: { read: true, bash: true, task: true },
    lossy: ["Bash(git:*)"],
  });
  expect(ocToCcTools({ read: true, bash: false })).toStrictEqual({ allowed: ["Read"], lossy: [] });
  expect(ocToCcTools({ bash: "git *" })).toStrictEqual({
    allowed: ["Bash"],
    lossy: ["bash: git *"],
  });
});

test("agent frontmatter converts both ways, cosmetics dropped by name", () => {
  const oc = ccToOcAgent({ name: "rev", description: "d", tools: "Read, Grep", color: "yellow" });
  expect(oc.data).toStrictEqual({
    name: "rev",
    description: "d",
    mode: "subagent",
    permission: { read: "allow", grep: "allow" },
  });
  expect(oc.lossy).toStrictEqual(["color yellow"]);
  const back = ocToCcAgent({ ...oc.data, permission: { read: "allow", deny: "bash" } });
  expect(back.data["tools"]).toStrictEqual(["Read"]);
});

test("model aliases gain and lose their provider prefix", () => {
  expect(toOcModel("sonnet")).toStrictEqual({ model: "anthropic/claude-sonnet-4-5", known: true });
  expect(toCcModel("anthropic/claude-opus-4-8")).toStrictEqual({ model: "opus", known: true });
  expect(toOcModel("grok/moon").known).toBe(true);
});
