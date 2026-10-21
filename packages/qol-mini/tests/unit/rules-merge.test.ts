import { expect, test } from "vite-plus/test";
import { mergeRules } from "../../src/core/harmonize/rules-merge.ts";

const claude = "# Project\n\n- rule one\n";

test("an AGENTS.md importing CLAUDE.md inlines it in place of the import", () => {
  const agents = "**Priority**: never touch /x.\n\nFollow @CLAUDE.md for the project guidelines.\n";
  expect(mergeRules(claude, agents)).toStrictEqual({
    text: "**Priority**: never touch /x.\n\n# Project\n\n- rule one\n",
    note: 'AGENTS.md: "Follow @CLAUDE.md for the project guidelines." replaced by CLAUDE.md',
  });
});

test("a CLAUDE.md importing AGENTS.md plus its own lines merges the other way", () => {
  const merged = mergeRules("@./AGENTS.md\n\n## Claude only\n- use /kaizen\n", "# Shared\n");
  expect(merged?.text).toBe("# Shared\n\n## Claude only\n- use /kaizen\n");
});

test("no import, or imports both ways, is no merge", () => {
  expect(mergeRules(claude, "# Other\n")).toBeNull();
  expect(mergeRules("@AGENTS.md\nx\n", "@CLAUDE.md\ny\n")).toBeNull();
  expect(mergeRules(claude, "mail me at a@CLAUDE.mdx\n")).toBeNull();
});
