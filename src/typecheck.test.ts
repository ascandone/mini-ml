import { expect, test } from "vitest";
import {
  UntypedAst,
  typecheck,
  TypeError,
  TypedAst,
  Analysis,
} from "./typecheck";
import { TVar, TVarResolution, generalize } from "./unify";
import { Ast } from "./ast";

test("infer constant type", () => {
  const a = new Analysis({ type: "constant", value: 42 });
  expect(a.typedAst.$.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Num"],
  });
});

test("unbound vars should fail typecheck", () => {
  const a = new Analysis({ type: "ident", ident: "not_found" });
  expect(a.errors.length).toBe(1);
  expect(a.errors[0]).toEqual<TypeError<Ast>>({
    type: "unbound-variable",
    ident: "not_found",
    node: expect.objectContaining({
      type: "ident",
      ident: "not_found",
    }),
  });
});

test("infer a variable contained in the context", () => {
  const a = new Analysis(
    {
      type: "ident",
      ident: "x",
    },
    {
      x: ["Num"],
    },
  );

  expect(a.typedAst.$.resolve()).toEqual({
    type: "bound",
    value: ["Num"],
  });
});

test("infer abstraction returning a constant", () => {
  const a = new Analysis({
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "constant",
      value: 42,
    },
  } as const) as any;

  expect(a.typedAst.$.resolve().type).toEqual("bound");
  const [t, param, body] = a.typedAst.$.resolve().value;
  expect(t).toEqual("->");
  expect(param.value.type).toEqual("unbound");
  expect(body.value).toEqual({ type: "bound", value: ["Num"] });
  expect(a.typedAst.body.$.resolve()).toEqual({
    type: "bound",
    value: ["Num"],
  });
});

test("infer application", () => {
  const a = new Analysis(
    {
      type: "application",
      caller: {
        type: "ident",
        ident: "add1",
      },
      arg: {
        type: "constant",
        value: 42,
      },
    },
    {
      add1: ["->", ["Num"], ["Num"]],
    },
  ) as any;

  expect(a.typedAst.$.resolve().value).toEqual(["Num"]);

  expect(a.typedAst.caller.$.resolve().type).toEqual("bound");
  const [t, $param, $body] = a.typedAst.caller.$.resolve().value;
  expect(t).toEqual("->");
  expect($param.resolve()).toEqual({ type: "bound", value: ["Num"] });
  expect($body.resolve()).toEqual({ type: "bound", value: ["Num"] });
});

test("detect type mismatch errors", () => {
  const a = new Analysis<{}>(
    {
      type: "application",
      caller: {
        type: "ident",
        ident: "not",
      },
      arg: {
        type: "constant",
        value: 42,
      },
    },
    {
      not: ["->", ["Bool"], ["Bool"]],
    },
  );

  expect(a.errors.length).toBe(1);
  expect(a.errors[0]).toEqual<TypeError<TypedAst>>({
    type: "type-mismatch",
    left: ["Bool"],
    right: ["Num"],
    node: expect.objectContaining({
      type: "constant",
      value: 42,
    }),
  });

  // Inferred types are kept
  expect((a.typedAst as any).$.resolve().type).toEqual("bound");
});

test("detect occurs check error", () => {
  const a = new Analysis<{ id: number }>({
    type: "abstraction",
    param: { name: "x", id: -1 },
    body: {
      type: "application",
      caller: {
        type: "ident",
        ident: "x",
        id: 0,
      },
      arg: {
        type: "ident",
        ident: "x",
        id: 1,
      },
      id: -1,
    },
    id: -1,
  });

  expect(a.errors.length).toBe(1);

  // TODO maybe the error should be moved to the param?
  expect(a.errors[0]).toEqual<TypeError<TypedAst>>({
    type: "occurs-check",
    left: expect.anything(),
    right: expect.anything(),
    node: expect.objectContaining({
      type: "ident",
      ident: "x",
      id: 1,
    }),
  });
});

test("infer identity function", () => {
  // \x -> x
  //=> 'a -> 'a
  const a = new Analysis({
    type: "abstraction",
    param: { name: "x" },

    body: {
      type: "ident",
      ident: "x",
    },
  } as UntypedAst);

  expect(a.typedAst.$.resolve().type).toEqual("bound");
  const [t, $param, $body] = (a.typedAst.$.resolve() as any).value;

  expect(t).toEqual("->");
  expect($param.resolve()).toEqual($body.resolve());
  expect($param.resolve()).toEqual((a.typedAst as any).param.$.resolve());
  expect($body.resolve()).toEqual((a.typedAst as any).body.$.resolve());
});

test("infer abstraction parameter", () => {
  // \f-> f 42
  //    => (Num -> a) -> a
  const a = new Analysis({
    type: "abstraction",
    param: { name: "f" },
    body: {
      type: "application",
      caller: {
        type: "ident",
        ident: "f",
      },
      arg: {
        type: "constant",
        value: 42,
      },
    },
  } as UntypedAst) as any;

  expect(a.typedAst.$.resolve().type, "bound");
  const [t, $param, $body] = a.typedAst.$.resolve().value;

  expect(t, "->");
  expect($param.value).toEqual(a.typedAst.param.$.resolve());
  expect($param.value).toEqual(a.typedAst.body.caller.$.resolve());
  expect($body.value).toEqual(a.typedAst.body.$.resolve());

  expect($param.value.type).toEqual("bound");
  const [t1, $param1, $body1] = $param.value.value;
  expect(t1).toEqual("->");
  expect($param1.value).toEqual({ type: "bound", value: ["Num"] });
  expect($body1.value).toEqual(a.typedAst.body.$.resolve());
});

test("infer if expression's condition", () => {
  const a = new Analysis({
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "if",
      condition: { type: "ident", ident: "x" },
      then: { type: "constant", value: null },
      else: { type: "constant", value: null },
    },
  } as const);

  expect(a.typedAst.body!.condition.$.resolve()).toEqual({
    type: "bound",
    value: ["Bool"],
  });
});

test("infer if expression's arg", () => {
  const a = new Analysis({
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "if",
      condition: { type: "constant", value: true },
      then: { type: "ident", ident: "x" },
      else: { type: "constant", value: 1 },
    },
  } as const);

  expect(a.typedAst.body!.then.$.resolve()).toEqual({
    type: "bound",
    value: ["Num"],
  });
});

test("infer if expression's value", () => {
  const a = new Analysis({
    type: "if",
    condition: { type: "constant", value: true },
    then: { type: "constant", value: null },
    else: { type: "constant", value: null },
  } as const);

  expect(a.typedAst.$.resolve()).toEqual({ type: "bound", value: ["Nil"] });
});

test("if should not typecheck if arg is not bool", () => {
  const a = new Analysis<{}>({
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "if",
      condition: { type: "constant", value: 0 },
      then: { type: "constant", value: 1 },
      else: { type: "constant", value: 1 },
    },
  });

  expect(a.errors.length).toBe(1);
});

test("infer recursion", () => {
  // f : Num -> 'a
  // let f = \x -> f 0 in 42

  const definition: UntypedAst = {
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "application",
      caller: { type: "ident", ident: "f" },
      arg: { type: "constant", value: 0 },
    },
  };

  const a = new Analysis({
    type: "let",
    binding: { name: "f" },
    definition,
    body: { type: "constant", value: 42 },
  });

  const resolved = (a.typedAst as any).binding.$.resolve();
  expect(resolved.type).toBe("bound");

  const [, $param, $body] = resolved.value;

  expect($param.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Num"],
  });

  expect($body.resolve().type).toBe("unbound");
});

test("infer monomorphic type in let", () => {
  // let x = 42 in x
  const a = new Analysis({
    type: "let",
    binding: { name: "x" },
    definition: {
      type: "constant",
      value: 42,
    },
    body: {
      type: "ident",
      ident: "x",
    },
  } as UntypedAst) as any;

  expect(a.typedAst.definition.$.resolve()).toEqual({
    type: "bound",
    value: ["Num"],
  });
  expect(a.typedAst.definition.$.resolve()).toEqual(
    a.typedAst.binding.$.resolve(),
  );
  expect(a.typedAst.binding.$.resolve()).toEqual({
    type: "bound",
    value: ["Num"],
  });
  expect(a.typedAst.body.$.resolve()).toEqual({
    type: "bound",
    value: ["Num"],
  });
});

test("generalizing a type in let should prevent type's variable to unify", () => {
  const id: UntypedAst = {
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "ident",
      ident: "x",
    },
  };

  // let id = \x -> x in id nil
  const a = new Analysis({
    type: "let",
    binding: { name: "id" },
    definition: id,
    body: {
      type: "application",
      caller: {
        type: "ident",
        ident: "id",
      },
      arg: {
        type: "constant",
        value: null,
      },
    },
  });

  expect(a.typedAst.binding.$.resolve().type).toEqual("bound");
  const [, $param, $body] = a.typedAst.binding.$.resolve().value;
  // generalization should prevent tv to bind in let definition
  expect($param.resolve().type).toEqual("unbound");
  expect($body.resolve().type).toEqual("unbound");

  expect(a.typedAst.body.$.resolve(), "body type").toEqual({
    type: "bound",
    value: ["Nil"],
  });
  expect(a.typedAst.$.resolve(), "ast type").toEqual({
    type: "bound",
    value: ["Nil"],
  });
});

test("it should be possible to instantiate a polytype in many ways", () => {
  const $a = TVar.fresh();
  const id = generalize(["->", $a, $a]);

  // let x = id 0; y = id True in nil
  const a = new Analysis<{}>(
    {
      type: "let",
      binding: { name: "x" },
      definition: {
        type: "application",
        caller: { type: "ident", ident: "id" },
        arg: { type: "constant", value: 42 },
      },
      body: {
        type: "let",
        binding: { name: "y" },
        definition: {
          type: "application",
          caller: { type: "ident", ident: "id" },
          arg: { type: "constant", value: true },
        },
        body: { type: "constant", value: null },
      },
    },
    { id },
  );

  expect(a.errors.length).toBe(0);
});

test("detecting a type error should not invalidate the inferred types", () => {
  const a = new Analysis(
    {
      type: "application",
      caller: { type: "ident", ident: "f" },
      arg: { type: "ident", ident: "x" },
    },
    { x: ["Int"] },
  );

  expect(a.errors.length).toBe(1);
  expect((a.typedAst as any).arg.$.resolve()).toEqual({
    type: "bound",
    value: ["Int"],
  });

  expect(a.errors[0]).toEqual<TypeError<Ast>>({
    type: "unbound-variable",
    ident: "f",
    node: expect.objectContaining({
      type: "ident",
      ident: "f",
    }),
  });
});
