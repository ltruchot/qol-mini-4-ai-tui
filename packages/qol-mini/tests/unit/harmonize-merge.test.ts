import { expect, test } from "vite-plus/test";
import { ocPerms } from "../../src/core/harmonize/perm-apply.ts";
import { ccPerms } from "../../src/core/harmonize/perm-apply-cc.ts";

test("a re-run replaces ours and keeps the user's, ours first", () => {
  const own = { action: "read", resource: "*", effect: "allow" } as const;
  const config: Record<string, unknown> = { permissions: [own] };
  const first = ocPerms(config, [], [{ action: "shell", resource: "git *", effect: "allow" }]);
  expect(config["permissions"]).toStrictEqual([
    { action: "shell", resource: "git *", effect: "allow" },
    own,
  ]);
  ocPerms(config, first, []);
  expect(config["permissions"]).toStrictEqual([own]);
  ocPerms(config, [], []);
  expect(config["permissions"]).toStrictEqual([own]);
});

test("claude arrays merge the same way, empty containers dropped", () => {
  const settings: Record<string, unknown> = { permissions: { allow: ["Read"] } };
  const mine = ccPerms(settings, [], [{ rule: "Bash(git:*)", effect: "allow" }]);
  expect(settings["permissions"]).toStrictEqual({ allow: ["Read", "Bash(git:*)"] });
  ccPerms(settings, mine, []);
  expect(settings["permissions"]).toStrictEqual({ allow: ["Read"] });
  ccPerms(settings, ["Read"], []);
  expect(settings).toStrictEqual({});
});
