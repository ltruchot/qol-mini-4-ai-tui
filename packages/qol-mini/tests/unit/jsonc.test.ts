import { expect, test } from "vite-plus/test";
import { parseJsonc } from "../../src/io/jsonc.ts";
import { patchJsonc } from "../../src/io/jsonc-patch.ts";

const text = `{
    // the user's comment
    "z": 1,
    "a": { "keep": true, "drop": 2, },
}
`;

test("jSONC parses with comments and trailing commas", () => {
  expect(parseJsonc(text)).toStrictEqual({ data: { z: 1, a: { keep: true, drop: 2 } } });
  expect("error" in parseJsonc("{ nope")).toBe(true);
});

test("a patch keeps comments, key order and indent, appends new keys", () => {
  const out = patchJsonc(
    text,
    { z: 1, a: { keep: true, drop: 2 } },
    { z: 1, a: { keep: true }, b: [1] },
  );
  expect(out).toContain("// the user's comment");
  expect(out.indexOf('"z"')).toBeLessThan(out.indexOf('"a"'));
  expect(out.indexOf('"a"')).toBeLessThan(out.indexOf('"b"'));
  expect(out).not.toContain("drop");
  expect(out).toContain('\n    "b"');
  expect(parseJsonc(out)).toStrictEqual({ data: { z: 1, a: { keep: true }, b: [1] } });
});
