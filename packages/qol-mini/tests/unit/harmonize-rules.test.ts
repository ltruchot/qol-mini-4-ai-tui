import { expect, test } from "vite-plus/test";
import { isBridge, rulesState } from "../../src/core/harmonize/rules.ts";
import { planRules } from "../../src/harmonize/slice-rules.ts";
import { mergeServers } from "../../src/harmonize/config-merge.ts";
import { literalSecrets } from "../../src/core/harmonize/mcp-secrets.ts";
import { ccToOcServer, ocToCcServer } from "../../src/core/harmonize/mcp.ts";

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

test("mcp servers convert both ways, secrets and foreign names are named", () => {
  const oc = ccToOcServer({ command: "npx", args: ["-y", "s"], env: { K: "v" } });
  expect(oc).toStrictEqual({ type: "local", command: ["npx", "-y", "s"], environment: { K: "v" } });
  expect(ocToCcServer({ type: "remote", url: "https://x" })).toStrictEqual({
    type: "http",
    url: "https://x",
  });
  expect(literalSecrets({ environment: { K: "v", T: "${X}" } })).toStrictEqual(["env K"]);
  const target = { mcp: { own: { type: "local" }, other: { type: "local" } } };
  const { mine, skipped } = mergeServers(target, "mcp", ["mcp:own"], { other: { type: "remote" } });
  expect(mine).toStrictEqual([]);
  expect(skipped).toStrictEqual(["other"]);
});
