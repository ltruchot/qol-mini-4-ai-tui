import type { JsonResult } from "./read.ts";
import type { Planned } from "./plan-types.ts";

export type Reads = { settings: JsonResult; ocConfig: JsonResult; mcpJson: JsonResult };
export type SliceOut = { files: Planned[]; warnings: string[]; conflicts: string[] };
export type MergeOut = { mine: string[]; warnings: string[] };
