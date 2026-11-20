import { expect, test } from "vite-plus/test";
import { commands, decode } from "../../src/vitals/report.ts";
import { cleanup } from "../helpers/tmp.ts";
import { healthy, vitals } from "../helpers/vitals.ts";

test("--json prints one report per gate, with the commands the findings name", async () => {
  const dir = await healthy({ "CLAUDE.local.md": "# Mine\n" });
  const run = await vitals([dir, "--repo-only", "--json"]);
  await cleanup(dir);
  expect(run.code).toBe(0);
  const reports = (JSON.parse(run.out) as unknown[]).map((one) => decode(JSON.stringify(one)));
  expect(reports.map((report) => [report.gate, report.passed])).toStrictEqual([
    ["agents-md", true],
    ["skills", true],
  ]);
  expect(commands(reports)).toStrictEqual([["harmonize", "--only", "rules", "--rules", "bridge"]]);
});

test("--json on an unreadable repository prints an empty list and exits 2", async () => {
  const dir = await healthy();
  const run = await vitals(["agents-md", `${dir}/nope`, "--json"]);
  await cleanup(dir);
  expect(run.code).toBe(2);
  expect(run.out).toBe("[]");
  expect(run.err).toContain("cannot read");
});

test("a command is kept once, and a user-scope finding names none", () => {
  const finding = { probe: "AM01", scope: "repository", command: ["harmonize", "--only", "rules"] };
  const report = decode(
    JSON.stringify({
      gate: "agents-md",
      passed: false,
      findings: [
        finding,
        { ...finding, probe: "AM02" },
        { ...finding, scope: "user", command: ["skills"] },
      ],
    }),
  );
  expect(commands([report])).toStrictEqual([["harmonize", "--only", "rules"]]);
});
