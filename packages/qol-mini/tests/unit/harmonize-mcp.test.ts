import { expect, test } from "vite-plus/test";
import { ccToOcServer, ocToCcServer } from "../../src/core/harmonize/mcp.ts";
import { literalSecrets } from "../../src/core/harmonize/mcp-secrets.ts";
import { mcpToCc, mcpToOc } from "../../src/harmonize/slice-mcp.ts";

test("env references translate: ${VAR} <-> {env:VAR}, a default is named", () => {
  const lossy: string[] = [];
  const oc = ccToOcServer(
    { command: "npx", args: ["-y", "s"], env: { K: "${KEY}", D: "${D:-x}" } },
    lossy,
  );
  expect(oc).toStrictEqual({
    type: "local",
    command: ["npx", "-y", "s"],
    environment: { K: "{env:KEY}", D: "{env:D}" },
  });
  expect(lossy).toStrictEqual(["${D:-x}: OpenCode has no default"]);
  const remote = { type: "remote", url: "https://x", headers: { A: "Bearer {env:T}" } };
  expect(ocToCcServer(remote, [])).toStrictEqual({
    type: "http",
    url: "https://x",
    headers: { A: "Bearer ${T}" },
  });
});

test("a disabled server stays off, extra keys and literal secrets are named", () => {
  expect(ocToCcServer({ type: "local", command: ["x"], enabled: false }, [])).toBeNull();
  const lossy: string[] = [];
  ocToCcServer({ type: "remote", url: "u", oauth: false }, lossy);
  expect(lossy).toStrictEqual(["oauth has no counterpart"]);
  const server = { env: { A: "v", B: "{env:B}", C: "${C}" }, headers: { H: "Bearer ${T}" } };
  expect(literalSecrets(server)).toStrictEqual(["env A"]);
});

test("openCode reads both forms; the kit writes mcp.servers, never a legacy name", () => {
  const config: Record<string, unknown> = { mcp: { old: { type: "local", command: ["o"] } } };
  const out = mcpToOc({ mcpServers: { old: { command: "a" }, ci: { command: "b" } } }, config, []);
  expect(out.mine).toStrictEqual(["mcp:ci"]);
  expect(out.warnings).toStrictEqual(["mcp server old exists, never written by this kit"]);
  expect(config["mcp"]).toStrictEqual({
    old: { type: "local", command: ["o"] },
    servers: { ci: { type: "local", command: ["b"] } },
  });
  const cc: Record<string, unknown> = {};
  mcpToCc(config, cc, []);
  expect(Object.keys(cc["mcpServers"] as object)).toStrictEqual(["old", "ci"]);
  expect(mcpToCc({}, {}, []).mine).toStrictEqual([]);
});
