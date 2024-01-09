import { test, expect, describe } from "vitest";
import { SpannedAst, unsafeParse, Span } from "./parser";

describe("numbers", () => {
  test("int number", () => {
    const INPUT = "42";

    expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
      type: "constant",
      value: 42,
      span: [0, 2],
    });
  });

  test("negative number", () => {
    const INPUT = "-42";

    expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
      type: "constant",
      value: -42,
      span: spanOf(INPUT, INPUT),
    });
  });

  test("float number", () => {
    const INPUT = "42.3";

    expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
      type: "constant",
      value: 42.3,
      span: [0, 4],
    });
  });
});

test("ident", () => {
  const INPUT = "abc";

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "ident",
    ident: "abc",
    span: [0, 3],
  });
});

test("infix ops", () => {
  // 1 + 2
  // == (+) 1 2
  // == ((+) 1) 2

  expectInfix("+");
  expectInfix("-");
  expectInfix("*");
  expectInfix("/");
  expectInfix("^");
  expectInfix("%");
  expectInfix("||");
  expectInfix("&&");
  expectInfix("==");
  expectInfix("!=");
  expectInfix("<=");
  expectInfix(">=");
  expectInfix("<");
  expectInfix(">");
});

test("infix expr prec", () => {
  const INPUT = "1 + 2 * 3";
  //= 1 + (2 * 3)
  //= `+` 1 (2 * 3)
  //= (`+` 1) (2 * 3)
  //= (`+` 1) (`*` 2 3)
  //= (`+` 1) (`*` 2 3)
  //= (`+` 1) ((`*` 2) 3)
  //= (`+` 1) ((`*` 2) 3)

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "application",
    caller: {
      type: "application",
      caller: { type: "ident", ident: "+", span: expect.anything() },
      arg: { type: "constant", value: 1, span: expect.anything() },
      span: expect.anything(),
    },
    arg: {
      type: "application",
      caller: expect.anything(),
      arg: { type: "constant", value: 3, span: expect.anything() },
      span: expect.anything(),
    },
    span: expect.anything(),
  });
});

test("let definition statement", () => {
  const INPUT = `let x = 42 in k`;

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    span: [0, INPUT.length],
    type: "let",
    binding: { name: "x", span: spanOf(INPUT, "x") },
    definition: {
      type: "constant",
      value: 42,
      span: spanOf(INPUT, "42"),
    },
    body: {
      type: "ident",
      ident: "k",
      span: spanOf(INPUT, "k"),
    },
  });
});

test("abstraction", () => {
  const INPUT = `\\ x -> 42`;
  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "abstraction",
    param: { name: "x", span: spanOf(INPUT, "x") },
    body: { type: "constant", value: 42, span: spanOf(INPUT, "42") },
    span: spanOf(INPUT, INPUT),
  });
});

test("abstraction+let", () => {
  expect(() => unsafeParse("\\ x -> let x = 0 in 0")).not.toThrow();
  expect(() => unsafeParse("let x = 0 in \\ x -> 42")).not.toThrow();
  expect(() => unsafeParse("let x = \\ x -> 42 in 0")).not.toThrow();
});

function spanOf(src: string, substr: string): Span {
  const index = src.indexOf(substr);
  return [index, index + substr.length];
}

test("application", () => {
  const INPUT = `f x`;

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "application",
    caller: {
      type: "ident",
      ident: "f",
      span: spanOf(INPUT, "f"),
    },
    arg: {
      type: "ident",
      ident: "x",
      span: spanOf(INPUT, "x"),
    },
    span: spanOf(INPUT, INPUT),
  });
});

test("if expression", () => {
  const INPUT = `if b then x else y`;

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "if",
    condition: { type: "ident", ident: "b", span: spanOf(INPUT, "b") },
    then: { type: "ident", ident: "x", span: spanOf(INPUT, "x") },
    else: { type: "ident", ident: "y", span: spanOf(INPUT, "y") },
    span: spanOf(INPUT, INPUT),
  });
});

test("application (2 args)", () => {
  const INPUT = `f x y`;

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "application",
    caller: {
      type: "application",
      caller: {
        type: "ident",
        ident: "f",
        span: spanOf(INPUT, "f"),
      },
      arg: {
        type: "ident",
        ident: "x",
        span: spanOf(INPUT, "x"),
      },
      span: spanOf(INPUT, INPUT),
    },
    arg: {
      type: "ident",
      ident: "y",
      span: spanOf(INPUT, "y"),
    },
    span: spanOf(INPUT, INPUT),
  });
});

test("parens", () => {
  const INPUT = "(f)";
  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "ident",
    ident: "f",
    span: spanOf(INPUT, "f"),
  });
});

test("infix and fn precedence", () => {
  // (plus 1) (\x -> x)
  const INPUT = "1 + \\x -> x";

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "application",
    caller: expect.anything(),
    arg: expect.objectContaining({ type: "abstraction" }),
    span: expect.anything(),
  });
});

test("infix and application precedence", () => {
  // (plus 1) (let x = ...)
  const INPUT = "1 + let x = 0 in 0";

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "application",
    caller: {
      type: "application",
      caller: expect.anything(),
      arg: expect.anything(),
      span: expect.anything(),
    },
    arg: expect.anything(),
    span: expect.anything(),
  });
});

test("infix and application precedence", () => {
  // (`+` 1) (f x)
  const INPUT = "1 + f x";

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "application",
    caller: {
      type: "application",
      caller: { type: "ident", ident: "+", span: expect.anything() },
      arg: { type: "constant", value: 1, span: expect.anything() },
      span: expect.anything(),
    },
    arg: expect.anything(),
    span: expect.anything(),
  });
});

test("curried functions sugar", () => {
  const INPUT = "\\x y -> z";

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "abstraction",
    param: { name: "x", span: spanOf(INPUT, "x") },
    body: {
      type: "abstraction",
      param: { name: "y", span: spanOf(INPUT, "y") },
      body: { type: "ident", ident: "z", span: spanOf(INPUT, "z") },
      span: spanOf(INPUT, INPUT),
    },
    span: spanOf(INPUT, INPUT),
  });
});

test("let function sugar", () => {
  const INPUT = "let f x y = z in 0";

  const abs: SpannedAst = {
    type: "abstraction",
    param: { name: "x", span: spanOf(INPUT, "x") },
    body: {
      type: "abstraction",
      param: { name: "y", span: spanOf(INPUT, "y") },
      body: { type: "ident", ident: "z", span: spanOf(INPUT, "z") },
      span: spanOf(INPUT, INPUT),
    },
    span: spanOf(INPUT, INPUT),
  };

  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "let",
    binding: { name: "f", span: spanOf(INPUT, "f") },
    definition: abs,
    body: { type: "constant", value: 0, span: spanOf(INPUT, "0") },
    span: spanOf(INPUT, INPUT),
  });
});

// 1 `op` 2
function expectInfix(op: string) {
  const INPUT = `1 ${op} 2`;
  expect(unsafeParse(INPUT)).toEqual<SpannedAst>({
    type: "application",
    caller: {
      type: "application",
      caller: {
        type: "ident",
        ident: op,
        span: spanOf(INPUT, op),
      },
      arg: { type: "constant", value: 1, span: spanOf(INPUT, "1") },
      span: spanOf(INPUT, INPUT),
    },
    arg: { type: "constant", value: 2, span: spanOf(INPUT, "2") },
    span: spanOf(INPUT, INPUT),
  });
}
