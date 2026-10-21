import { KitError } from "../core/errors.ts";
import { RuleMode, Side } from "../core/schema/harmony.ts";
import { SLICES, type PlanOpts, type Slice } from "../harmonize/plan-types.ts";
import type { HOpts } from "./harmonize-ctx.ts";

const FROM = [...Side.options, "auto"] as const;

// A value outside the list is an error, never a silent default
function oneOf<T extends string>(flag: string, value: unknown, allowed: readonly T[]): T {
  const text = String(value);
  const hit = allowed.find((a) => a === text);
  if (hit === undefined)
    throw new KitError(`--${flag} ${text}: expected one of ${allowed.join(", ")}`);
  return hit;
}

function slices(value: unknown): Slice[] {
  const parts = String(value)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  if (parts.length === 0) throw new KitError(`--only: expected some of ${SLICES.join(", ")}`);
  return parts.map((part) => oneOf("only", part, SLICES));
}

export function optsOf(opts: HOpts): PlanOpts {
  return {
    ...(opts.from === undefined ? {} : { from: oneOf("from", opts.from, FROM) }),
    ...(opts.rules === undefined ? {} : { rules: oneOf("rules", opts.rules, RuleMode.options) }),
    ...(opts.only === undefined ? {} : { only: slices(opts.only) }),
    replace: opts.replace === true,
  };
}
