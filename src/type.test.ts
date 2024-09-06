import { test, expect } from "vitest";
import { OccursCheckError, Type, TypeMismatchError, Unifier } from "./type";

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
  const t0 = u.fresh();

  expect(u.resolve(t0)).toEqual<Type>({
    tag: "Var",
    id: 0,
  });
});

test("unify a concrete type and a var", () => {
  const u = new Unifier();

  const t0 = u.fresh();
  u.unify(t0, int);

  expect(u.resolve(t0)).toEqual<Type>(int);
});

test("unify a var and a concrete type", () => {
  const u = new Unifier();

  const t0 = u.fresh();
  u.unify(int, t0);

  expect(u.resolve(t0)).toEqual<Type>(int);
});

test("unify to another TVar", () => {
  const u = new Unifier();

  const t0 = u.fresh();
  const t1 = u.fresh();
  u.unify(t0, t1);
  expect(u.resolve(t0)).toEqual<Type>(u.resolve(t1));
});

test("unify to another bound TVar should fail", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  u.unify(t0, int);

  const t1 = u.fresh();
  u.unify(t1, bool);

  const t2 = u.fresh();
  u.unify(t1, t2);

  expect(() => u.unify(t0, t2)).toThrow(TypeMismatchError);
});

test("unify 3 lvars", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();
  const t2 = u.fresh();

  u.unify(t0, t2);
  u.unify(t2, t1);
  u.unify(t0, int);

  expect(u.resolve(t0)).toEqual<Type>(int);
  expect(u.resolve(t1)).toEqual<Type>(int);
  expect(u.resolve(t2)).toEqual<Type>(int);
});

test("TVars should be reactive (left)", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();

  u.unify(t0, t1);
  u.unify(t1, int);

  expect(u.resolve(t0), "a").toEqual(int);
  expect(u.resolve(t1), "b").toEqual(int);
});

test("TVars should be reactive (right)", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();

  u.unify(t1, t0);
  u.unify(t1, int);

  expect(u.resolve(t0), "a").toEqual(int);
  expect(u.resolve(t1), "b").toEqual(int);
});

test("trying to link a linked var (1)", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();
  const t2 = u.fresh();

  u.unify(t2, t0); // a~>c
  u.unify(t1, t0); // a~>b
  u.unify(t1, int); // b=int

  expect(u.resolve(t0), "a").toEqual(int);
  expect(u.resolve(t1), "b").toEqual(int);
  expect(u.resolve(t2), "c").toEqual(int);
});

test("trying to link a linked var (2)", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();
  const t2 = u.fresh();

  u.unify(t0, t2);
  u.unify(t0, t1);
  u.unify(t1, int);

  expect(u.resolve(t0), "a").toEqual(int);
  expect(u.resolve(t1), "b").toEqual(int);
  expect(u.resolve(t2), "c").toEqual(int);
});

test("trying to unify two linked vars", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();
  const t2 = u.fresh();
  const t3 = u.fresh();

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
  const t0 = u.fresh();
  const t1 = u.fresh();
  u.unify(t0, t1);
  expect(u.resolve(t0)).toEqual<Type>(t0);
  expect(u.resolve(t0)).toEqual(u.resolve(t1));
});

test("unify nested TVar", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  u.unify(list(t0), list(bool));
  expect(u.resolve(t0)).toEqual<Type>(bool);
});

test("unify twice to a const", () => {
  const u = new Unifier();
  const t0 = u.fresh();

  u.unify(t0, int);
  u.unify(t0, int);

  expect(u.resolve(t0)).toEqual<Type>(int);
});

test("unify to a const, then to a different one should fail", () => {
  const u = new Unifier();
  const t0 = u.fresh();

  u.unify(t0, int);
  expect(() => u.unify(t0, bool)).toThrow(TypeMismatchError);
});

test("transitive unifications", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();
  u.unify(t0, t1);
  u.unify(t0, int);

  expect(u.resolve(t0), "a == int").toEqual(int);
  expect(u.resolve(t1), "b == int").toEqual(int);
});

test("transitive unifications (3)", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();
  const t2 = u.fresh();

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
  const t0 = u.fresh();
  const t1 = u.fresh();

  u.unify(t0, t1);
  u.unify(t1, t0);

  expect(u.resolve(t0)).toEqual(u.resolve(t1));
});

test("recursively linked TVars (3 steps)", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();
  const t2 = u.fresh();

  u.unify(t0, t1);
  u.unify(t1, t2);
  u.unify(t2, t0);

  expect(u.resolve(t0)).toEqual(u.resolve(t1));
  expect(u.resolve(t0)).toEqual(u.resolve(t2));
});

test("occurs check", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  expect(() => u.unify(t0, list(t0))).toThrow(OccursCheckError);
});

test("occurs check of unified values", () => {
  const u = new Unifier();
  const t0 = u.fresh();
  const t1 = u.fresh();

  u.unify(t0, t1);

  expect(() => u.unify(t0, list(t1))).toThrow(OccursCheckError);
});

// describe("generalization", () => {
//   test("generalize primitive value", () => {
// const u = new Unifier();
//     const poly = generalize(int);
//     expect(poly).toEqual(int);
//   });

//   test("generalize var bound to primitive", () => {
// const u = new Unifier();
//     const t0 = u.fresh();
//     u.unify(t0, int);
//     const poly = generalize(t0);
//     expect(poly).toEqual(int);
//   });

//   test("generalize single unbound var", () => {
// const u = new Unifier();
//     const t0 = u.fresh();
//     const poly = generalize(t0);

//     expect((poly as TVar).resolve().type).toEqual("quantified");
//   });

//   test("generalize many vars", () => {
// const u = new Unifier();
//     const t0 = u.fresh();
//     const t1 = u.fresh();

//     const poly = generalize(["Tuple", t0, t1]) as any[];

//     expect(poly.length).toEqual(3);
//     const [t, $g1, $g2] = poly;

//     expect(t, "Tuple");

//     expect($g1.value.type).toEqual("quantified");
//     expect($g2.value.type).toEqual("quantified");

//     expect($g1.value.id).toEqual(0);
//     expect($g2.value.id).toEqual(1);
//   });

//   test("generalize many vars when linked", () => {
// const u = new Unifier();
//     const t0 = u.fresh();

//     const poly = generalize(["Tuple", t0, t0]) as any[];

//     expect(poly.length).toEqual(3);
//     const [t, $g1, $g2] = poly;

//     expect(t, "Tuple");

//     expect($g1.value.type).toEqual("quantified");
//     expect($g2.value.type).toEqual("quantified");

//     expect($g1.value.id).toEqual(0);
//     expect($g2.value.id).toEqual(0);
//   });

//   test("generalize var bound to a nested type to generalize ", () => {
// const u = new Unifier();
//     const t0 = u.fresh();
//     const t1 = u.fresh();
//     u.unify(t0, ["->", t1, t1]);

//     const poly = generalize(t0) as any[];

//     expect(poly.length).toEqual(3);
//     const [t, $g1, $g2] = poly;

//     expect(t, "->");

//     expect($g1.resolve()).toEqual({ type: "quantified", id: 0 });
//     expect($g2.resolve()).toEqual({ type: "quantified", id: 0 });
//   });

//   test("do not generalize vars that appear in the context", () => {
// const u = new Unifier();
//     const t0 = u.fresh();
//     const t1 = u.fresh();

//     const poly = generalize(["->", t0, t1], {
//       // Note t1 is not free in context
//       x: list(t1),
//     }) as any[];

//     expect(poly.length).toEqual(3);
//     const [, $ga, $gb] = poly;

//     expect($ga.resolve()).toEqual({ type: "quantified", id: 0 });
//     expect($gb).toBe(t1);
//   });

//   test("instantiate concrete type", () => {
// const u = new Unifier();
//     const m = instantiate(int);
//     expect(m).toEqual(int);
//   });

//   test("instantiate single var", () => {
// const u = new Unifier();
//     const t0 = u.fresh();
//     const $g = generalize(t0);
//     const $m = instantiate($g) as TVar;
//     expect($m.resolve().type).toEqual("unbound");
//     expect(($m.resolve() as any).id).not.toEqual((u.resolve(t0) as any).id);
//   });

//   test("instantiate two different vars", () => {
// const u = new Unifier();
//     const t0 = u.fresh();
//     const t1 = u.fresh();

//     const $g = generalize(["Pair", t0, t1]);

//     const [_, t0i, t1i] = instantiate($g) as any[];

//     expect(t0i.resolve().type).toEqual("unbound");
//     expect(t1i.resolve().type).toEqual("unbound");
//     expect(t0i.resolve().id).not.toEqual(t1i.resolve().id);
//   });

//   test("instantiate two same vars", () => {
//     const t0 = u.fresh();
//     const $g = generalize(["Pair", t0, t0]);

//     const [, t0i, t1i] = instantiate($g) as any[];

//     expect(t0i.value.type).toEqual("unbound");
//     expect(t1i.value.type).toEqual("unbound");

//     expect(t0i.value.id).toEqual(t1i.value.id);
//   });
// });
