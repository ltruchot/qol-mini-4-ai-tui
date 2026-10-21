import { expect, test } from "vite-plus/test";
import { asks } from "../../src/kit/parse.ts";

test("install asks only with no option on a real console", () => {
  expect(asks([], true)).toBe(true);
  expect(asks([], false)).toBe(false);
  expect(asks(["--replace"], true)).toBe(false);
  expect(asks(["--no-sounds"], true)).toBe(false);
});
