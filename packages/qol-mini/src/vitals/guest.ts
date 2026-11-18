import path from "node:path";

export type View = { preopen: string; repo: string; home: string | undefined };

type Paths = Pick<typeof path, "parse" | "relative" | "sep">;

// A host path as the gate sees it: the drive root is preopened as "/"
function inside(root: string, abs: string, p: Paths): string {
  return `/${p.relative(root, abs).split(p.sep).join("/")}`;
}

// WASI has no working directory and no drive letters: the gate reads one
// preopened root, and every path it is given is absolute below it. A home
// directory on another drive is out of the gate's reach, so it is not named.
export function guestView(repo: string, home: string, p: Paths = path): View {
  const { root } = p.parse(repo);
  const reachable = home !== "" && p.parse(home).root === root;
  return {
    preopen: root,
    repo: inside(root, repo, p),
    home: reachable ? inside(root, home, p) : undefined,
  };
}
