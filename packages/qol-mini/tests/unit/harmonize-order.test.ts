import { expect, test } from "vite-plus/test";
import type { OcPerm } from "../../src/core/harmonize/perm-cc.ts";
import { matches } from "../../src/core/harmonize/wildcard.ts";
import { permToCc, permToOc } from "../../src/harmonize/slice-perm.ts";

// OpenCode 2.1 evaluation (permission.ts): the last matching rule wins
const decide = (rules: OcPerm[], action: string, input: string): string | undefined =>
  rules.findLast((r) => matches(action, r.action) && matches(input, r.resource))?.effect;

const settings = (allow: string[], ask: string[], deny: string[]): Record<string, unknown> => ({
  permissions: { allow, ask, deny },
});

test("converted rules decide in OpenCode as Claude Code does: deny, then ask", () => {
  const config: Record<string, unknown> = {};
  permToOc(settings(["Bash(git:*)"], ["Bash"], ["Bash(git push:*)"]), config, [], false);
  const rules = config["permissions"] as OcPerm[];
  expect(decide(rules, "shell", "git push origin")).toBe("deny");
  expect(decide(rules, "shell", "git status")).toBe("ask");
  expect(decide(rules, "shell", "ls")).toBe("ask");
});

test("the user's native rules come after ours and keep the last word", () => {
  const own: OcPerm = { action: "shell", resource: "git push *", effect: "deny" };
  const config: Record<string, unknown> = { permissions: [own] };
  permToOc(settings(["Bash(git:*)"], [], []), config, [], false);
  expect((config["permissions"] as OcPerm[]).at(-1)).toStrictEqual(own);
});

test("a rule that would override a stricter legacy rule waits for --replace", () => {
  const config = { permission: { bash: { "rm *": "deny" } } };
  const held = permToOc(settings(["Bash"], [], []), structuredClone(config), [], false);
  expect(held.mine).toStrictEqual([]);
  expect(held.conflicts?.[0]).toContain('allow shell "*" would override deny shell "rm *"');
  const forced = permToOc(settings(["Bash"], [], []), structuredClone(config), [], true);
  expect(forced.mine).toStrictEqual(["shell|*|allow"]);
});

test("an OpenCode exception is named: Claude Code keeps the stricter rule", () => {
  const config = { permission: { bash: { "*": "deny", "git status": "allow" } } };
  const target: Record<string, unknown> = {};
  const out = permToCc(config, target, []);
  expect(out.warnings.join("\n")).toContain("Claude Code keeps the stricter rule");
  expect(target).toStrictEqual({
    permissions: { allow: ["Bash(git status)"], deny: ["Bash"] },
  });
});
