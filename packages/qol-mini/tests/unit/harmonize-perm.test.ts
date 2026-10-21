import { expect, test } from "vite-plus/test";
import { ccToOc } from "../../src/core/harmonize/perm-cc.ts";
import { ocToCc } from "../../src/core/harmonize/perm-oc.ts";

const one = (action: string, resource: string, effect = "allow"): unknown => ({
  perms: [{ action, resource, effect }],
  lossy: null,
});

test("claude rules map to opencode v2 rules", () => {
  expect(ccToOc("Bash(git:*)", "allow")).toStrictEqual(one("shell", "git *"));
  expect(ccToOc("Bash", "allow")).toStrictEqual(one("shell", "*"));
  expect(ccToOc("Read(./.env)", "deny")).toStrictEqual(one("read", ".env", "deny"));
  expect(ccToOc("Edit(//etc/hosts)", "deny")).toStrictEqual(one("edit", "/etc/hosts", "deny"));
  expect(ccToOc("Write(/src/**)", "ask")).toStrictEqual(one("edit", "src/**", "ask"));
  expect(ccToOc("Agent(worker)", "deny")).toStrictEqual(one("subagent", "worker", "deny"));
  expect(ccToOc("mcp__github__create_issue", "allow")).toStrictEqual(
    one("github_create_issue", "*"),
  );
  expect(ccToOc("mcp__my_srv", "deny")).toStrictEqual(one("my_srv_*", "*", "deny"));
  expect(ccToOc("Frobnicate", "allow")).toBeNull();
});

test("a domain covers both schemes, a wildcard domain is named", () => {
  expect(
    ccToOc("WebFetch(domain:example.com)", "allow")?.perms.map((p) => p.resource),
  ).toStrictEqual(["https://example.com/*", "http://example.com/*"]);
  expect(ccToOc("WebFetch(domain:*.x.com)", "allow")?.lossy).toContain("matches more URLs");
  expect(ccToOc("WebFetch(domain:*.x.com)", "deny")?.lossy).toBeNull();
});

test("opencode rules map back to claude rules", () => {
  expect(ocToCc({ action: "shell", resource: "git *", effect: "allow" })).toStrictEqual({
    rule: "Bash(git *)",
    effect: "allow",
  });
  expect(ocToCc({ action: "shell", resource: "*", effect: "ask" })?.rule).toBe("Bash");
  expect(ocToCc({ action: "read", resource: "/etc/x", effect: "deny" })?.rule).toBe(
    "Read(//etc/x)",
  );
  expect(ocToCc({ action: "webfetch", resource: "http://e.com/*", effect: "deny" })?.rule).toBe(
    "WebFetch(domain:e.com)",
  );
  expect(ocToCc({ action: "doom_loop", resource: "*", effect: "allow" })).toBeNull();
});
