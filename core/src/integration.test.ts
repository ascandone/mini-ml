import { expect, test } from "vitest";
import { unsafeParse } from "./parser";
import { typecheck } from "./typecheck";
import { typePPrint } from "./type/pretty-printer";
import { prelude } from "./prelude";

test("+ operator", () => {
  const INPUT = `let x = 1 + 2 in x`;
  assertType(INPUT, "Num");
});

test("identity fn", () => {
  const INPUT = "\\x -> x";
  assertType(INPUT, "t0 -> t0");
});

test("2-arity fn", () => {
  assertType("\\x -> \\y -> x", "t0 -> t1 -> t0");
  assertType("\\x -> \\y -> y", "t0 -> t1 -> t1");
});

test("shadowing", () => {
  assertType("\\x -> \\x -> x", "t0 -> t1 -> t1");
});

test("sum abstr", () => {
  assertType(`\\x -> \\y -> x + y`, "Num -> Num -> Num");
});

test("infix ops", () => {
  assertType(`1 + 2 ^ 4 - 4 / 2`, "Num");
});

function assertType(src: string, type: string) {
  const parsedAst = unsafeParse(src);
  const typedAst = typecheck(parsedAst, prelude);
  const t = typePPrint(typedAst.$);
  expect(t).toBe(type);
}
