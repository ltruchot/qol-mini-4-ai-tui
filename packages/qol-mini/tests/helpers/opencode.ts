// Contract with OpenCode: decode generated files with the schemas OpenCode
// 2.1 loads them with (@opencode/schema, pinned in the catalog). A markdown
// command or agent that fails here is dropped by OpenCode without a word.
import { ConfigAgent } from "@opencode/schema/config/agent";
import { ConfigCommand } from "@opencode/schema/config/command";
import { ConfigMCP } from "@opencode/schema/config/mcp";
import { Permission } from "@opencode/schema/permission";
import { Schema } from "effect";
import { expect } from "vite-plus/test";
import { split } from "../../src/core/harmonize/fm.ts";

type Json = Record<string, unknown>;
const ok = (schema: Schema.Top, value: unknown): boolean =>
  Schema.decodeUnknownOption(schema as Schema.Codec<unknown>)(value, { errors: "all" })._tag ===
  "Some";

export function expectCommand(md: string): void {
  const { data, body } = split(md);
  expect(ok(ConfigCommand.Info, { ...data, template: body.trim() })).toBe(true);
}

// OpenCode decodes an agent natively only when every key is native; the kit
// writes native keys only, so the native schema is the contract
export function expectAgent(md: string): void {
  const { data, body } = split(md);
  const native = new Set(["variant", ...Object.keys(ConfigAgent.Info.fields)]);
  expect(Object.keys(data).filter((k) => !native.has(k))).toStrictEqual([]);
  expect(ok(ConfigAgent.Info, { ...data, system: body.trim() })).toBe(true);
}

export function expectConfig(config: Json): void {
  expect(Array.isArray(config["permission"])).toBe(false);
  if (config["permissions"] !== undefined)
    expect(ok(Permission.Ruleset, config["permissions"])).toBe(true);
  const servers = (config["mcp"] as Json | undefined)?.["servers"] as Json | undefined;
  for (const server of Object.values(servers ?? {}))
    expect(ok(ConfigMCP.Server, server)).toBe(true);
}
