// Model alias -> provider/model. A value with a "/" is a provider/model already:
// passed through. An alias outside the table passes through with a warning by
// the caller: OpenCode and Claude Code both fail on names they cannot resolve.
export const MODEL_ALIAS: Record<string, string> = {
  sonnet: "anthropic/claude-sonnet-4-5",
  opus: "anthropic/claude-opus-4-8",
  haiku: "anthropic/claude-haiku-4-5",
  "sonnet[1m]": "anthropic/claude-sonnet-4-5[1m]",
  "opus[1m]": "anthropic/claude-opus-4-8[1m]",
};

export function toOcModel(model: string): { model: string; known: boolean } {
  if (model.includes("/")) return { model, known: true };
  const mapped = MODEL_ALIAS[model];
  return mapped === undefined ? { model, known: false } : { model: mapped, known: true };
}

export function toCcModel(model: string): { model: string; known: boolean } {
  const alias = Object.entries(MODEL_ALIAS).find(([, full]) => full === model);
  if (alias !== undefined) return { model: alias[0], known: true };
  if (model.includes("/")) return { model, known: false };
  return { model, known: true };
}
