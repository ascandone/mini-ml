import { expect, test } from "vitest";
import { unsafeParse } from "./parser";
import { typecheck } from "./typecheck";
import { typePPrint } from "./type/pretty-printer";
import { prelude } from "./prelude";

test("example", () => {
  const INPUT = `let x = 1 + 2 in x`;
  assertType(INPUT, "Num");
});

function assertType(src: string, type: string) {
  const parsedAst = unsafeParse(src);
  const typedAst = typecheck(parsedAst, prelude);
  const t = typePPrint(typedAst.$);
  expect(t).toBe(type);
}
