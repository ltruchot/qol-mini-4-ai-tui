import { expect, test } from "vite-plus/test";
import { toCcModel, toOcModel } from "../../src/core/harmonize/model.ts";
import { ccToOcCommand, ocToCcCommand } from "../../src/harmonize/slice-commands.ts";

test("commands keep a model OpenCode decodes, fork maps to subagent", () => {
  const oc = ccToOcCommand({ description: "d", model: "haiku", context: "fork", agent: "w" });
  expect(oc.data).toStrictEqual({
    description: "d",
    model: "anthropic/claude-haiku-5-5",
    subagent: true,
    agent: "w",
  });
  expect(ccToOcCommand({ model: "gpt-x", "allowed-tools": "Read" }).lossy).toStrictEqual([
    "allowed-tools has no OpenCode form",
    "model gpt-x has no provider/model form",
  ]);
  expect(ocToCcCommand({ subtask: true, agent: "w" }).data).toMatchObject({
    context: "fork",
    agent: "w",
  });
});

test("models follow the latest of their family", () => {
  expect(toOcModel("sonnet[1m]")).toBe("anthropic/claude-sonnet-5-5");
  expect(toOcModel("claude-opus-4-8")).toBe("anthropic/claude-opus-4-8");
  expect(toOcModel("inherit")).toBeNull();
  expect(toCcModel("anthropic/claude-opus-4-8")).toBe("claude-opus-4-8");
  expect(toCcModel("openai/gpt-x")).toBeNull();
});
