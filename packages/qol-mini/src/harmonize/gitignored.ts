import { spawnSync } from "node:child_process";
import type { Plan } from "./plan-types.ts";

// The files a harmonized repo relies on: the rules, the lock, every
// generated file, this run's and the earlier ones'
export function kept(p: Plan, earlier: string[]): string[] {
  const rules = p.rulesMode === "pure" ? ["AGENTS.md"] : ["AGENTS.md", "CLAUDE.md"];
  const files = p.files.map((f) => f.rel);
  return [...new Set([...rules, ".claude/qol-mini.lock.json", ...files, ...earlier])];
}

// Which of `paths` git ignores, each with the rule that ignores it
// (`git check-ignore -v`: `<source>:<line>:<pattern>\t<path>`). No git, or
// not a repo: nothing to say.
export function ignoredBy(root: string, paths: string[]): string[] {
  if (paths.length === 0) return [];
  const run = spawnSync("git", ["-C", root, "check-ignore", "-v", "--stdin"], {
    input: paths.join("\n"),
    encoding: "utf8",
  });
  if (run.error !== undefined || (run.status !== 0 && run.status !== 1)) return [];
  return run.stdout
    .split("\n")
    .filter((line) => line.includes("\t"))
    .map((line) => {
      const [rule = "", path = ""] = line.split("\t");
      const [source, number, ...pattern] = rule.split(":");
      return `${path} is ignored by git (${source ?? ""}:${number ?? ""}: ${pattern.join(":")}): remove that line, or the file never reaches the repo`;
    });
}
