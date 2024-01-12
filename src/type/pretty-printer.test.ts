import { expect, test, beforeEach } from "vitest";
import { typePPrint } from "./pretty-printer";
import { TVar, unify } from "../unify";

beforeEach(() => {
  TVar.resetId();
});

test("0-arity types", () => {
  expect(typePPrint(["Int"])).toBe("Int");
});

test("n-arity types", () => {
  expect(typePPrint(["List", ["Int"]])).toBe("List Int");
  expect(typePPrint(["Tuple", ["Int"], ["Bool"]])).toBe("Tuple Int Bool");
});

test("nested types", () => {
  expect(typePPrint(["List", ["Maybe", ["Int"]]])).toBe("List (Maybe Int)");
});

test("type var", () => {
  const $a = TVar.fresh();
  expect(typePPrint($a)).toBe("t0");
});

test("type vars", () => {
  const $a = TVar.fresh(),
    $b = TVar.fresh();

  expect(typePPrint(["Tuple", $a, $b])).toBe("Tuple t0 t1");
});

test("bound types", () => {
  const $a = TVar.fresh();
  unify($a, ["Int"]);

  expect(typePPrint(["List", $a])).toBe("List Int");
});

test("arrow", () => {
  expect(typePPrint(["->", ["Int"], ["Bool"]])).toBe("Int -> Bool");
});

test("2-arity arrow ", () => {
  expect(typePPrint(["->", ["Int"], ["->", ["Bool"], ["Int"]]])).toBe(
    "Int -> Bool -> Int"
  );
});

test("higher order function", () => {
  expect(typePPrint(["->", ["->", ["Int"], ["Bool"]], ["Int"]])).toBe(
    "(Int -> Bool) -> Int"
  );
});

test("tv as arg", () => {
  const $a = TVar.fresh();
  expect(typePPrint(["->", $a, $a])).toBe("t0 -> t0");
});

test("n-arity type nested in arrow", () => {
  expect(typePPrint(["->", ["List", ["Int"]], ["Maybe", ["Bool"]]])).toBe(
    "List Int -> Maybe Bool"
  );
});
