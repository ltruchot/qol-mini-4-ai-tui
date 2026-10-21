// Path specifiers. Claude Code: `//p` absolute, `~/p` home, `/p` from the
// project root, `p` or `./p` from the working directory. OpenCode 2.1 matches
// a path relative to the project, or absolute outside it, and expands `~/`.
export function ccToOcPath(spec: string): string {
  if (spec.startsWith("//")) return spec.slice(1);
  if (spec.startsWith("~/")) return spec;
  if (spec.startsWith("./")) return spec.slice(2);
  if (spec.startsWith("/")) return spec.slice(1);
  return spec;
}

export function ocToCcPath(resource: string): string {
  if (resource.startsWith("/")) return `/${resource}`;
  return resource;
}
