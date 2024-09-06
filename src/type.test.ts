import { test, expect, describe } from "vitest";
import {
  OccursCheckError,
  PolyType,
  Type,
  TypeMismatchError,
  Unifier,
} from "./type";

const int: Type = { tag: "Named", name: "Int", args: [] };
const bool: Type = { tag: "Named", name: "Bool", args: [] };
const list = (x: Type): Type => ({
  tag: "Named",
  name: "List",
  args: [x],
});
const tuple = (...ts: Type[]): Type => ({
  tag: "Named",
  name: "Tuple",
  args: ts,
});

test("unifing two concrete vars when they match", () => {
  const u = new Unifier();

  expect(() => u.unify(int, int)).not.toThrow();
  expect(() => u.unify(list(int), list(int))).not.toThrow();
});

test("unify two concrete vars that do not match", () => {
  const u = new Unifier();

  expect(() => u.unify(int, bool), "different type").toThrow();
  expect(() => u.unify(tuple(int, int), tuple()), "different arity").toThrow(
    TypeMismatchError,
  );
  expect(() => u.unify(list(int), list(bool)), "different args").toThrow(
    TypeMismatchError,
  );
});

test("TypeVar is unbound initially", () => {
  const u = new Unifier();
  const t0 = u.freshVar();

  expect(u.resolve(t0)).toEqual<Type>({
    tag: "Var",
    id: 0,
  });
});

test("unify a concrete type and a var", () => {
  const u = new Unifier();

  const t0 = u.freshVar();
  u.unify(t0, int);

  expect(u.resolve(t0)).toEqual<Type>(int);
});

test("unify a var and a concrete type", () => {
  const u = new Unifier();

  const t0 = u.freshVar();
  u.unify(int, t0);

  expect(u.resolve(t0)).toEqual<Type>(int);
});

test("unify to another TVar", () => {
  const u = new Unifier();

  const t0 = u.freshVar();
  const t1 = u.freshVar();
  u.unify(t0, t1);
  expect(u.resolve(t0)).toEqual<Type>(u.resolve(t1));
});

test("unify to another bound TVar should fail", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  u.unify(t0, int);

  const t1 = u.freshVar();
  u.unify(t1, bool);

  const t2 = u.freshVar();
  u.unify(t1, t2);

  expect(() => u.unify(t0, t2)).toThrow(TypeMismatchError);
});

test("unify 3 lvars", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();
  const t2 = u.freshVar();

  u.unify(t0, t2);
  u.unify(t2, t1);
  u.unify(t0, int);

  expect(u.resolve(t0)).toEqual<Type>(int);
  expect(u.resolve(t1)).toEqual<Type>(int);
  expect(u.resolve(t2)).toEqual<Type>(int);
});

test("TVars should be reactive (left)", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();

  u.unify(t0, t1);
  u.unify(t1, int);

  expect(u.resolve(t0), "a").toEqual(int);
  expect(u.resolve(t1), "b").toEqual(int);
});

test("TVars should be reactive (right)", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();

  u.unify(t1, t0);
  u.unify(t1, int);

  expect(u.resolve(t0), "a").toEqual(int);
  expect(u.resolve(t1), "b").toEqual(int);
});

test("trying to link a linked var (1)", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();
  const t2 = u.freshVar();

  u.unify(t2, t0); // a~>c
  u.unify(t1, t0); // a~>b
  u.unify(t1, int); // b=int

  expect(u.resolve(t0), "a").toEqual(int);
  expect(u.resolve(t1), "b").toEqual(int);
  expect(u.resolve(t2), "c").toEqual(int);
});

test("trying to link a linked var (2)", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();
  const t2 = u.freshVar();

  u.unify(t0, t2);
  u.unify(t0, t1);
  u.unify(t1, int);

  expect(u.resolve(t0), "a").toEqual(int);
  expect(u.resolve(t1), "b").toEqual(int);
  expect(u.resolve(t2), "c").toEqual(int);
});

test("trying to unify two linked vars", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();
  const t2 = u.freshVar();
  const t3 = u.freshVar();

  u.unify(t1, t0); // a~>b
  u.unify(t3, t2); // c~>d
  u.unify(t0, t2); // c~>a

  u.unify(t1, int);

  expect(u.resolve(t0), "a").toEqual(int);
  expect(u.resolve(t1), "b").toEqual(int);
  expect(u.resolve(t2), "c").toEqual(int);
  expect(u.resolve(t3), "d").toEqual(int);
});

test("unify to another TVar", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();
  u.unify(t0, t1);
  expect(u.resolve(t0)).toEqual<Type>(t0);
  expect(u.resolve(t0)).toEqual(u.resolve(t1));
});

test("unify nested TVar", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  u.unify(list(t0), list(bool));
  expect(u.resolve(t0)).toEqual<Type>(bool);
});

test("unify twice to a const", () => {
  const u = new Unifier();
  const t0 = u.freshVar();

  u.unify(t0, int);
  u.unify(t0, int);

  expect(u.resolve(t0)).toEqual<Type>(int);
});

test("unify to a const, then to a different one should fail", () => {
  const u = new Unifier();
  const t0 = u.freshVar();

  u.unify(t0, int);
  expect(() => u.unify(t0, bool)).toThrow(TypeMismatchError);
});

test("transitive unifications", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();
  u.unify(t0, t1);
  u.unify(t0, int);

  expect(u.resolve(t0), "a == int").toEqual(int);
  expect(u.resolve(t1), "b == int").toEqual(int);
});

test("transitive unifications (3)", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();
  const t2 = u.freshVar();

  u.unify(t0, t1);
  u.unify(t1, t2);

  expect(u.resolve(t0), "a").toEqual<Type>(t0);
  expect(u.resolve(t1), "b").toEqual<Type>(t0);
  expect(u.resolve(t1), "c").toEqual<Type>(t0);

  u.unify(t0, bool);

  expect(u.resolve(t0), "a == true").toEqual<Type>(bool);
  expect(u.resolve(t1), "b == true").toEqual<Type>(bool);
  expect(u.resolve(t2), "b == true").toEqual<Type>(bool);
});

test("recursively linked TVars", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();

  u.unify(t0, t1);
  u.unify(t1, t0);

  expect(u.resolve(t0)).toEqual(u.resolve(t1));
});

test("recursively linked TVars (3 steps)", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();
  const t2 = u.freshVar();

  u.unify(t0, t1);
  u.unify(t1, t2);
  u.unify(t2, t0);

  expect(u.resolve(t0)).toEqual(u.resolve(t1));
  expect(u.resolve(t0)).toEqual(u.resolve(t2));
});

test("occurs check", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  expect(() => u.unify(t0, list(t0))).toThrow(OccursCheckError);
});

test("occurs check of unified values", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();

  u.unify(t0, t1);

  expect(() => u.unify(t0, list(t1))).toThrow(OccursCheckError);
});

test("occurs check of unified values", () => {
  const u = new Unifier();
  const t0 = u.freshVar();
  const t1 = u.freshVar();

  u.unify(t0, list(t1));

  expect(u.resolve(t0)).toEqual(list(t1));

  u.unify(t1, int);
  expect(u.resolve(t0)).toEqual(list(int));
});

describe("generalization", () => {
  test("generalize primitive value", () => {
    const u = new Unifier();
    const poly = new PolyType(int, u);
    expect(poly.instantiate()).toEqual(int);
  });

  test("generalize var bound to primitive", () => {
    const u = new Unifier();
    const t0 = u.freshVar();
    u.unify(t0, int);
    const poly = new PolyType(t0, u);
    expect(poly.instantiate()).toEqual(int);
  });

  test("generalize single unbound var", () => {
    const u = new Unifier();
    const t0 = u.freshVar();
    const poly = new PolyType(t0, u);

    expect(poly.instantiate()).not.toEqual<Type>(t0);
  });

  test("generalization and instantiation prevents the original var to be mutated", () => {
    const u = new Unifier();
    const t0 = u.freshVar();

    const mono = new PolyType(t0, u).instantiate();

    u.unify(mono, int);
    expect(u.resolve(t0)).toEqual(t0);
  });

  test("generalize many vars", () => {
    const u = new Unifier();
    const t0 = u.freshVar();
    const t1 = u.freshVar();

    const poly = new PolyType(tuple(t0, t1), u);

    const mono = poly.instantiate();

    expect(mono).toEqual(
      tuple(
        expect.objectContaining({
          tag: "Var",
          id: expect.anything(),
        }),
        expect.objectContaining({
          tag: "Var",
          id: expect.anything(),
        }),
      ),
    );

    expect(mono).not.toEqual(tuple(t0, t1));
  });

  test("generalize many vars when linked", () => {
    const u = new Unifier();
    const t0 = u.freshVar();

    const poly = new PolyType(tuple(t0, t0), u);

    const mono = poly.instantiate();
    expect(mono).toEqual<Type>(
      tuple(
        {
          tag: "Var",
          id: 1,
        },
        {
          tag: "Var",
          id: 1,
        },
      ),
    );
  });

  test("do not generalize vars that appear in the context", () => {
    const u = new Unifier();
    const t0 = u.freshVar();
    const t1 = u.freshVar();

    const mono = new PolyType(tuple(t0, t1), u, [
      // Note t1 is not free in context
      list(t1),
    ]).instantiate();

    expect(mono).toEqual<Type>(
      tuple(
        expect.not.objectContaining<Type>(t0),
        t1, // t1 was not free, therefore it must not be generalized
      ),
    );
  });

  test("do not generalize vars that appear in the context when resolved", () => {
    const u = new Unifier();
    const t0 = u.freshVar();
    const t1 = u.freshVar();

    u.unify(t0, t1);
    const mono = new PolyType(t0, u, [
      // t1 appears in context instead of t0
      // but t1 is linked to t0
      list(t1),
    ]).instantiate();

    expect(mono).toEqual<Type>(t0);
  });

  test("do not generalize vars that appear in the context when resolved (2)", () => {
    const u = new Unifier();
    const t0 = u.freshVar();
    const t1 = u.freshVar();

    u.unify(t1, t0);

    // make sure t0 resolves as t1
    expect(u.resolve(t0)).toEqual<Type>(t1);

    const mono = new PolyType(t0, u, [
      // t0 does appear in the context
      // but t0 is linked to t1
      list(t0),
    ]).instantiate();

    expect(mono).toEqual<Type>(t1);
  });
});
