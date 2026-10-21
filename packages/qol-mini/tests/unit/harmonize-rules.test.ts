import { expect, test } from "vite-plus/test";
import { isBridge, rulesState } from "../../src/core/harmonize/rules.ts";
import { planRules } from "../../src/harmonize/slice-rules.ts";

const base = { claude: "file", bridge: false, agents: "file" } as const;

test("the eight rules layouts are told apart", () => {
  expect(rulesState({ ...base, claude: "absent", agents: "absent" })).toBe("none");
  expect(rulesState({ ...base, claude: "absent" })).toBe("pure");
  expect(rulesState({ ...base, agents: "absent" })).toBe("claude-only");
  expect(rulesState({ ...base, bridge: true })).toBe("bridge");
  expect(rulesState({ ...base, claude: "symlink", claudeTarget: "AGENTS.md" })).toBe("amp");
  expect(rulesState({ ...base, agents: "symlink", agentsTarget: "CLAUDE.md" })).toBe("legacy");
  expect(rulesState({ ...base, agents: "symlink", agentsTarget: "other" })).toBe("broken");
  expect(isBridge("@AGENTS.md\n")).toBe(true);
});

test("rule moves reach pure from every layout", () => {
  expect(planRules("claude-only", "pure", false, "claude").intents).toStrictEqual([
    { op: "mv", path: "CLAUDE.md", to: "AGENTS.md" },
  ]);
  expect(planRules("legacy", "pure", false, "claude").intents).toStrictEqual([
    { op: "unlink", path: "AGENTS.md" },
    { op: "mv", path: "CLAUDE.md", to: "AGENTS.md" },
  ]);
  expect(planRules("amp", "symlink", false, "claude").intents).toStrictEqual([]);
  expect(planRules("diverged", "pure", false, "claude").conflict).toContain("--replace");
  expect(planRules("none", "pure", false, "claude").intents).toStrictEqual([]);
});
