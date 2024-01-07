import { test, expect, beforeEach, describe } from "vitest";
import {
  TVar,
  TVarResolution,
  UnifyError,
  generalize,
  instantiate,
  unify,
} from "./type";

beforeEach(() => {
  TVar.resetId();
});

test("unifing two concrete vars when they match", () => {
  expect(() => unify(["Int"], ["Int"])).not.toThrow();
  expect(() => unify(["List", ["Int"]], ["List", ["Int"]])).not.toThrow();
});

test("unify two concrete vars that do not match", () => {
  expect(() => unify(["Int"], ["Bool"]), "different type").toThrow();
  expect(
    () => unify(["Tuple", ["Int"], ["Int"]], ["Tuple"]),
    "different arity"
  ).toThrow();
  expect(
    () => unify(["List", ["Int"]], ["List", ["Bool"]]),
    "different args"
  ).toThrow();
});

test("TypeVar is unbound initially", () => {
  const $a = TVar.fresh();

  expect($a.resolve()).toEqual<TVarResolution>({
    type: "unbound",
    id: 0,
  });
});

test("unify a concrete type and a var", () => {
  const $a = TVar.fresh();
  unify($a, ["Int"]);

  expect($a.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Int"],
  });
});

test("unify a var and a concrete type", () => {
  const $a = TVar.fresh();
  unify(["Int"], $a);

  expect($a.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Int"],
  });
});

test("unify to another TVar", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();
  unify($a, $b);
  expect($a.resolve()).toEqual<TVarResolution>($b.resolve());
});

test("unify to another bound TVar should fail", () => {
  const $a = TVar.fresh();
  unify($a, ["Int"]);

  const $b = TVar.fresh();
  unify($b, ["Bool"]);

  const $c = TVar.fresh();
  unify($b, $c);

  expect(() => unify($a, $c)).toThrow(UnifyError);
});

test("unify 3 lvars", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();
  const $c = TVar.fresh();

  unify($a, $c);
  unify($c, $b);
  unify($a, ["Int"]);

  expect($a.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Int"],
  });
  expect($b.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Int"],
  });
  expect($c.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Int"],
  });
});

test("TVars should be reactive (left)", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();

  unify($a, $b);
  unify($b, ["Int"]);

  expect($a.resolve(), "a").toEqual({ type: "bound", value: ["Int"] });
  expect($b.resolve(), "b").toEqual({ type: "bound", value: ["Int"] });
});

test("TVars should be reactive (right)", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();

  unify($b, $a);
  unify($b, ["Int"]);

  expect($a.resolve(), "a").toEqual({ type: "bound", value: ["Int"] });
  expect($b.resolve(), "b").toEqual({ type: "bound", value: ["Int"] });
});

test("trying to link a linked var (1)", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();
  const $c = TVar.fresh();

  unify($c, $a); // a~>c
  unify($b, $a); // a~>b
  unify($b, ["Int"]); // b=["Int"]

  expect($a.resolve(), "a").toEqual({ type: "bound", value: ["Int"] });
  expect($b.resolve(), "b").toEqual({ type: "bound", value: ["Int"] });
  expect($c.resolve(), "c").toEqual({ type: "bound", value: ["Int"] });
});

test("trying to link a linked var (2)", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();
  const $c = TVar.fresh();

  unify($a, $c);
  unify($a, $b);
  unify($b, ["Int"]);

  expect($a.resolve(), "a").toEqual({ type: "bound", value: ["Int"] });
  expect($b.resolve(), "b").toEqual({ type: "bound", value: ["Int"] });
  expect($c.resolve(), "c").toEqual({ type: "bound", value: ["Int"] });
});

test("trying to unify two linked vars", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();
  const $c = TVar.fresh();
  const $d = TVar.fresh();

  unify($b, $a); // a~>b
  unify($d, $c); // c~>d
  unify($a, $c); // c~>a

  unify($b, ["Int"]);

  expect($a.resolve(), "a").toEqual({ type: "bound", value: ["Int"] });
  expect($b.resolve(), "b").toEqual({ type: "bound", value: ["Int"] });
  expect($c.resolve(), "c").toEqual({ type: "bound", value: ["Int"] });
  expect($d.resolve(), "d").toEqual({ type: "bound", value: ["Int"] });
});

test("unify to another TVar", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();
  unify($a, $b);
  expect($a.resolve()).toEqual<TVarResolution>({ type: "unbound", id: 0 });
  expect($a.resolve()).toEqual($b.resolve());
});

test("unify nested TVar", () => {
  const $a = TVar.fresh();
  unify(["List", $a], ["List", ["Bool"]]);
  expect($a.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Bool"],
  });
});

test("unify twice to a const", () => {
  const $a = TVar.fresh();

  unify($a, ["Int"]);
  unify($a, ["Int"]);

  expect($a.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Int"],
  });
});

test("unify to a const, then to a different one should fail", () => {
  const $a = TVar.fresh();

  unify($a, ["Int"]);
  expect(() => unify($a, ["Bool"])).toThrow(UnifyError);
});

test("transitive unifications", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();
  unify($a, $b);
  unify($a, ["Int"]);

  expect($a.resolve(), 'a == ["Int"]').toEqual({
    type: "bound",
    value: ["Int"],
  });
  expect($b.resolve(), 'b == ["Int"]').toEqual({
    type: "bound",
    value: ["Int"],
  });
});

test("transitive unifications (3)", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();
  const $c = TVar.fresh();

  unify($a, $b);
  unify($b, $c);

  expect($a.resolve(), "a").toEqual<TVarResolution>({ type: "unbound", id: 0 });
  expect($b.resolve(), "b").toEqual<TVarResolution>({ type: "unbound", id: 0 });
  expect($b.resolve(), "c").toEqual<TVarResolution>({ type: "unbound", id: 0 });

  unify($a, ["Bool"]);

  expect($a.resolve(), "a == true").toEqual<TVarResolution>({
    type: "bound",
    value: ["Bool"],
  });
  expect($b.resolve(), "b == true").toEqual<TVarResolution>({
    type: "bound",
    value: ["Bool"],
  });
  expect($c.resolve(), "b == true").toEqual<TVarResolution>({
    type: "bound",
    value: ["Bool"],
  });
});

test("occurs check", () => {
  const $a = TVar.fresh();
  expect(() => unify($a, ["Int", $a])).toThrow(UnifyError);
});

test("occurs check of unified values", () => {
  const $a = TVar.fresh();
  const $b = TVar.fresh();

  unify($a, $b);

  expect(() => unify($a, ["List", $b])).toThrow(UnifyError);
});

describe("generalization", () => {
  test("generalize primitive value", () => {
    const poly = generalize(["Int"]);
    expect(poly).toEqual(["Int"]);
  });

  test("generalize var bound to primitive", () => {
    const $a = TVar.fresh();
    unify($a, ["Int"]);
    const poly = generalize($a);
    expect(poly).toEqual(["Int"]);
  });

  test("generalize single unbound var", () => {
    const $a = TVar.fresh();
    const poly = generalize($a);

    expect((poly as TVar).resolve().type).toEqual("quantified");
  });

  test("generalize many vars", () => {
    const $a = TVar.fresh();
    const $b = TVar.fresh();

    const poly = generalize(["Tuple", $a, $b]) as any[];

    expect(poly.length).toEqual(3);
    const [t, $g1, $g2] = poly;

    expect(t, "Tuple");

    expect($g1.value.type).toEqual("quantified");
    expect($g2.value.type).toEqual("quantified");

    expect($g1.value.id).toEqual(0);
    expect($g2.value.id).toEqual(1);
  });

  test("generalize many vars when linked", () => {
    const $a = TVar.fresh();

    const poly = generalize(["Tuple", $a, $a]) as any[];

    expect(poly.length).toEqual(3);
    const [t, $g1, $g2] = poly;

    expect(t, "Tuple");

    expect($g1.value.type).toEqual("quantified");
    expect($g2.value.type).toEqual("quantified");

    expect($g1.value.id).toEqual(0);
    expect($g2.value.id).toEqual(0);
  });

  test("generalize var bound to a nested type to generalize ", () => {
    const $a = TVar.fresh();
    const $b = TVar.fresh();
    unify($a, ["->", $b, $b]);

    const poly = generalize($a) as any[];

    expect(poly.length).toEqual(3);
    const [t, $g1, $g2] = poly;

    expect(t, "->");

    expect($g1.value.type).toEqual("quantified");
    expect($g2.value.type).toEqual("quantified");

    expect($g1.value.id).toEqual(0);
    expect($g2.value.id).toEqual(0);
  });

  test("instantiate concrete type", () => {
    const m = instantiate(["Int"]);
    expect(m).toEqual(["Int"]);
  });

  test("instantiate single var", () => {
    const $a = TVar.fresh();
    const $g = generalize($a);
    const $m = instantiate($g) as TVar;
    expect($m.resolve().type).toEqual("unbound");
    expect(($m.resolve() as any).id).not.toEqual(($a.resolve() as any).id);
  });

  test("instantiate two different vars", () => {
    const $a = TVar.fresh();
    const $b = TVar.fresh();

    const $g = generalize(["Pair", $a, $b]);

    const [_, $ai, $bi] = instantiate($g) as any[];

    expect($ai.resolve().type).toEqual("unbound");
    expect($bi.resolve().type).toEqual("unbound");
    expect($ai.resolve().id).not.toEqual($bi.resolve().id);
  });

  test("instantiate two same vars", () => {
    const $a = TVar.fresh();
    const $g = generalize(["Pair", $a, $a]);

    const [, $ai, $bi] = instantiate($g) as any[];

    expect($ai.value.type).toEqual("unbound");
    expect($bi.value.type).toEqual("unbound");

    expect($ai.value.id).toEqual($bi.value.id);
  });
});
