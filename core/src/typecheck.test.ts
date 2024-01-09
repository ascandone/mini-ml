import { expect, test } from "vitest";
import { UnboundVariableError, UntypedAst, typecheck } from "./typecheck";
import { TVar, TVarResolution, UnifyError, generalize } from "./unify";

test("infer constant type", () => {
  const ast = typecheck({ type: "constant", value: 42 });

  expect(ast.$.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Num"],
  });
});

test("unbound vars should fail typecheck", () => {
  const ast: UntypedAst = { type: "ident", ident: "not-found" };
  expect(() => typecheck(ast)).toThrow(UnboundVariableError);
});

test("infer a variable contained in the context", () => {
  const ast = typecheck(
    {
      type: "ident",
      ident: "x",
    },
    {
      x: ["Num"],
    }
  );

  expect(ast.$.resolve()).toEqual({
    type: "bound",
    value: ["Num"],
  });
});

test("infer abstraction returning a constant", () => {
  const ast = typecheck({
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "constant",
      value: 42,
    },
  } as const) as any;

  expect(ast.$.resolve().type).toEqual("bound");
  const [t, param, body] = ast.$.resolve().value;
  expect(t).toEqual("->");
  expect(param.value.type).toEqual("unbound");
  expect(body.value).toEqual({ type: "bound", value: ["Num"] });
  expect(ast.body.$.resolve()).toEqual({ type: "bound", value: ["Num"] });
});

test("infer application", () => {
  const ast = typecheck(
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
    }
  ) as any;

  expect(ast.$.resolve().value).toEqual(["Num"]);

  expect(ast.caller.$.resolve().type).toEqual("bound");
  const [t, $param, $body] = ast.caller.$.resolve().value;
  expect(t).toEqual("->");
  expect($param.resolve()).toEqual({ type: "bound", value: ["Num"] });
  expect($body.resolve()).toEqual({ type: "bound", value: ["Num"] });
});

test("infer identity function", () => {
  // \x -> x
  //=> 'a -> 'a
  const ast = typecheck({
    type: "abstraction",
    param: { name: "x" },

    body: {
      type: "ident",
      ident: "x",
    },
  } as UntypedAst);

  expect(ast.$.resolve().type).toEqual("bound");
  const [t, $param, $body] = (ast.$.resolve() as any).value;

  expect(t).toEqual("->");
  expect($param.resolve()).toEqual($body.resolve());
  expect($param.resolve()).toEqual((ast as any).param.$.resolve());
  expect($body.resolve()).toEqual((ast as any).body.$.resolve());
});

test("infer abstraction parameter", () => {
  // \f-> f 42
  //    => (Num -> a) -> a
  const ast = typecheck({
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

  expect(ast.$.resolve().type, "bound");
  const [t, $param, $body] = ast.$.resolve().value;

  expect(t, "->");
  expect($param.value).toEqual(ast.param.$.resolve());
  expect($param.value).toEqual(ast.body.caller.$.resolve());
  expect($body.value).toEqual(ast.body.$.resolve());

  expect($param.value.type).toEqual("bound");
  const [t1, $param1, $body1] = $param.value.value;
  expect(t1).toEqual("->");
  expect($param1.value).toEqual({ type: "bound", value: ["Num"] });
  expect($body1.value).toEqual(ast.body.$.resolve());
});

test("infer if expression's condition", () => {
  const f = typecheck({
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "if",
      condition: { type: "ident", ident: "x" },
      then: { type: "constant", value: null },
      else: { type: "constant", value: null },
    },
  } as const);

  expect(f.body!.condition.$.resolve()).toEqual({
    type: "bound",
    value: ["Bool"],
  });
});

test("infer if expression's arg", () => {
  const f = typecheck({
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "if",
      condition: { type: "constant", value: true },
      then: { type: "ident", ident: "x" },
      else: { type: "constant", value: 1 },
    },
  } as const);

  expect(f.body!.then.$.resolve()).toEqual({ type: "bound", value: ["Num"] });
});

test("if should not typecheck if arg is not bool", () => {
  const f: UntypedAst = {
    type: "abstraction",
    param: { name: "x" },
    body: {
      type: "if",
      condition: { type: "constant", value: 0 },
      then: { type: "constant", value: 1 },
      else: { type: "constant", value: 1 },
    },
  };

  expect(() => typecheck(f)).toThrow(UnifyError);
});

// TODO fix bug in unify
test.skip("infer recursion", () => {
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

  const ast = typecheck({
    type: "let",
    binding: { name: "f" },
    definition,
    body: { type: "constant", value: 42 },
  });

  const resolved = (ast as any).binding.$.resolve();
  expect(resolved.type).toBe("bound");

  const [, $param, $body] = resolved.value;

  expect($param.resolve()).toEqual<TVarResolution>({
    type: "bound",
    value: ["Num"],
  });

  expect($body.resolve()).toEqual<TVarResolution>({
    type: "unbound",
    id: 0,
  });
});

test("infer monomorphic type in let", () => {
  // let x = 42 in x
  const ast = typecheck({
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

  expect(ast.definition.$.resolve()).toEqual({ type: "bound", value: ["Num"] });
  expect(ast.definition.$.resolve()).toEqual(ast.binding.$.resolve());
  expect(ast.binding.$.resolve()).toEqual({ type: "bound", value: ["Num"] });
  expect(ast.body.$.resolve()).toEqual({ type: "bound", value: ["Num"] });
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

  // let id = \x -> x in id Unit
  const ast = typecheck({
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
  }) as any;

  expect(ast.binding.$.resolve().type).toEqual("bound");
  const [, $param, $body] = ast.binding.$.resolve().value;
  // generalization should prevent tv to bind in let definition
  expect($param.resolve().type).toEqual("unbound");
  expect($body.resolve().type).toEqual("unbound");

  expect(ast.body.$.resolve(), "body type").toEqual({
    type: "bound",
    value: ["Unit"],
  });
  expect(ast.$.resolve(), "ast type").toEqual({
    type: "bound",
    value: ["Unit"],
  });
});

test("it should be possible to instantiate a polytype in many ways", () => {
  const $a = TVar.fresh();
  const id = generalize(["->", $a, $a]);

  // let x = id 0; y = id True in Unit
  const ast: UntypedAst = {
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
  };

  expect(() => typecheck(ast, { id })).not.toThrow();
});
