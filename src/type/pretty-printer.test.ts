import { expect, test } from "vitest";
import { typePPrint } from "./pretty-printer";
import { bool, int, list, tuple, maybe, fn } from "../__test__/types";
import { Unifier } from "../type";

test("0-arity types", () => {
  expect(typePPrint(int)).toBe("Int");
});

test("n-arity types", () => {
  expect(typePPrint(list(int))).toBe("List Int");
  expect(typePPrint(tuple(int, bool))).toBe("Tuple Int Bool");
});

test("nested types", () => {
  expect(typePPrint(list(maybe(int)))).toBe("List (Maybe Int)");
});

test("type var", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  expect(typePPrint(t0)).toBe("t0");
});

test.todo("type vars", () => {
  const u = new Unifier();
  const t0 = u.freshVar(),
    t1 = u.freshVar();

  expect(typePPrint(tuple(t0, t1))).toBe("Tuple t0 t1");
});

test("bound types", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  u.unify(t0, int);

  let t = u.resolve(list(t0));
  expect(typePPrint(t)).toBe("List Int");
});

test("arrow", () => {
  expect(typePPrint(fn([int], bool))).toBe("Int -> Bool");
});

test("2-arity arrow ", () => {
  expect(typePPrint(fn([int, bool], int))).toBe("Int -> Bool -> Int");
});

test("higher order function", () => {
  const t = fn([fn([int], bool)], int);

  expect(typePPrint(t)).toBe("(Int -> Bool) -> Int");
});

test("tv as arg", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  expect(typePPrint(fn([t0], t0))).toBe("t0 -> t0");
});

test("n-arity type nested in arrow", () => {
  const t = fn([list(int)], maybe(bool));
  expect(typePPrint(t)).toBe("List Int -> Maybe Bool");
});
