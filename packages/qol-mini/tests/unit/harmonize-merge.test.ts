import { expect, test } from "vite-plus/test";
import { ccPerms, ocPerms } from "../../src/core/harmonize/perm-apply.ts";

test("a re-run replaces ours and keeps the user's", () => {
  const config = { permission: [{ action: "read", resource: "*", effect: "allow" }] };
  const first = ocPerms(config, [], [{ action: "shell", resource: "git *", effect: "allow" }]);
  expect(config.permission).toHaveLength(2);
  ocPerms(config, first, []);
  expect(config.permission).toStrictEqual([{ action: "read", resource: "*", effect: "allow" }]);
});

test("claude arrays merge the same way, empty arrays dropped", () => {
  const settings = { permissions: { allow: ["Read"] } };
  const mine = ccPerms(settings, [], [{ rule: "Bash(git:*)", effect: "allow" }]);
  expect(settings.permissions).toStrictEqual({ allow: ["Read", "Bash(git:*)"] });
  ccPerms(settings, mine, []);
  expect(settings.permissions).toStrictEqual({ allow: ["Read"] });
  ccPerms(settings, ["Read"], []);
  expect(settings.permissions).toStrictEqual({});
});
