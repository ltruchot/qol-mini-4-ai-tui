import { expect, test } from "vite-plus/test";
import { ccToOc } from "../../src/core/harmonize/perm-cc.ts";
import { ocToCc } from "../../src/core/harmonize/perm-oc.ts";

test("claude rules map to opencode entries", () => {
  expect(ccToOc("Bash(git:*)", "allow")).toStrictEqual({
    action: "shell",
    resource: "git *",
    effect: "allow",
  });
  expect(ccToOc("Read(./.env)", "deny")).toStrictEqual({
    action: "read",
    resource: "./.env",
    effect: "deny",
  });
  expect(ccToOc("WebFetch(domain:example.com)", "allow")).toStrictEqual({
    action: "webfetch",
    resource: "https://example.com/*",
    effect: "allow",
  });
  expect(ccToOc("Read", "ask")).toStrictEqual({ action: "read", resource: "*", effect: "ask" });
  expect(ccToOc("mcp__server__tool", "allow")).toBeNull();
});

test("opencode entries map back to claude rules", () => {
  expect(ocToCc({ action: "shell", resource: "git *", effect: "allow" })).toStrictEqual({
    rule: "Bash(git:*)",
    effect: "allow",
  });
  expect(
    ocToCc({ action: "webfetch", resource: "https://example.com/*", effect: "deny" }),
  ).toStrictEqual({
    rule: "WebFetch(domain:example.com)",
    effect: "deny",
  });
  expect(ocToCc({ action: "task", resource: "*", effect: "allow" })).toBeNull();
});
