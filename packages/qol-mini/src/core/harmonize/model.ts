// Claude Code model aliases <-> OpenCode `provider/model` ids (models.dev).
// An alias follows the latest model of its family: update the table when a
// family moves. OpenCode rejects a model that is not `provider/model`: a
// command carrying one is dropped on load, so a value with no mapping is
// omitted and named, never copied.
export const MODEL_ALIAS: Record<string, string> = {
  opus: "anthropic/claude-opus-5-5",
  sonnet: "anthropic/claude-sonnet-5-5",
  haiku: "anthropic/claude-haiku-5-5",
  fable: "anthropic/claude-fable-5-1",
};

const OC_MODEL = /^[^/#]+\/[^#]+(?:#[^#]+)?$/;

export function toOcModel(model: string): string | null {
  const alias = MODEL_ALIAS[model.replace(/\[1m\]$/, "")];
  if (alias !== undefined) return alias;
  if (/^claude-[a-z0-9-]+$/.test(model)) return `anthropic/${model}`;
  return OC_MODEL.test(model) ? model : null;
}

// `inherit` and an omitted model mean the same in Claude Code
export function toCcModel(model: string): string | null {
  const alias = Object.entries(MODEL_ALIAS).find(([, full]) => full === model);
  if (alias !== undefined) return alias[0];
  const anthropic = /^anthropic\/(claude-[a-z0-9-]+)$/.exec(model);
  return anthropic?.[1] ?? null;
}
