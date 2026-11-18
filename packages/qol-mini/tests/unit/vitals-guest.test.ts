import path from "node:path";
import { expect, test } from "vite-plus/test";
import { guestView } from "../../src/vitals/guest.ts";

test("pOSIX: the root is preopened and paths pass unchanged", () => {
  expect(guestView("/work/repo", "/home/dev", path.posix)).toStrictEqual({
    preopen: "/",
    repo: "/work/repo",
    home: "/home/dev",
  });
});

test("the filesystem root itself is a repository path", () => {
  expect(guestView("/", "", path.posix)).toStrictEqual({
    preopen: "/",
    repo: "/",
    home: undefined,
  });
});

test("windows: the drive is the root, separators become slashes", () => {
  expect(guestView(String.raw`C:\work\repo`, String.raw`C:\Users\dev`, path.win32)).toStrictEqual({
    preopen: "C:\\",
    repo: "/work/repo",
    home: "/Users/dev",
  });
});

test("windows: a home directory on another drive is not named", () => {
  const view = guestView(String.raw`D:\repo`, String.raw`C:\Users\dev`, path.win32);
  expect(view).toStrictEqual({ preopen: "D:\\", repo: "/repo", home: undefined });
});
