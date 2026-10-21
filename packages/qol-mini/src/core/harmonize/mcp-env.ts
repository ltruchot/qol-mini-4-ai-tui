// Environment references inside MCP values. Claude Code expands `${VAR}` and
// `${VAR:-default}`; OpenCode 2.1 substitutes `{env:VAR}` only and reads
// `{file:path}`. A value is rewritten reference by reference, the rest kept.
const CC_REF = /\$\{([A-Za-z_][A-Za-z0-9_]*)(:-[^}]*)?\}/g;
const OC_REF = /\{env:([^}]+)\}/g;

export function toOcEnv(value: string, lossy: string[]): string {
  return value.replace(CC_REF, (_, name: string, fallback: string | undefined) => {
    if (fallback !== undefined) lossy.push(`\${${name}${fallback}}: OpenCode has no default`);
    return `{env:${name}}`;
  });
}

export function toCcEnv(value: string, lossy: string[]): string {
  if (value.includes("{file:")) lossy.push(`${value}: {file:} has no Claude Code form`);
  return value.replace(OC_REF, (_, name: string) => `\${${name}}`);
}

// Rewrite every string of a JSON value: strings, arrays, maps
export function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]));
  return value;
}

// Does the value name a variable instead of holding the secret itself?
export const isReference = (value: string): boolean =>
  /\$\{[A-Za-z_][A-Za-z0-9_]*(:-[^}]*)?\}|\{env:[^}]+\}|\{file:[^}]+\}/.test(value);
