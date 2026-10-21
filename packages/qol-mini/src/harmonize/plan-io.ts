import type { JsonResult } from "./read.ts";
import type { Planned } from "./plan-types.ts";

export type Reads = { settings: JsonResult; ocConfig: JsonResult; mcpJson: JsonResult };
export type SliceOut = { files: Planned[]; warnings: string[]; conflicts: string[] };
// A merge that would change what a file the user wrote means names it in
// `conflicts`: nothing is written until --replace.
export type MergeOut = { mine: string[]; warnings: string[]; conflicts?: string[] };
