import { Ast, Const } from "./ast";
import {
  TVar,
  Type,
  UnifyError,
  UnifyErrorType,
  generalize,
  instantiate,
  unify,
} from "./unify";

export type UntypedAst<T = {}> = Ast<T>;
export type TypedAst<T = {}> = Ast<T & { $: TVar }>;

export type Context = Record<string, Type>;

export type TypeError<Node> =
  | {
      type: "unbound-variable";
      ident: string;
      node: Node;
    }
  | {
      type: UnifyErrorType;
      node: Node;
      left: Type;
      right: Type;
    };

function* unifyNode<T>(
  ast: TypedAst<T>,
  t1: Type,
  t2: Type,
): Generator<TypeError<TypedAst<T>>> {
  try {
    unify(t1, t2);
  } catch (e) {
    if (!(e instanceof UnifyError)) {
      throw e;
    }

    yield {
      type: e.error,
      left: e.left,
      right: e.right,
      node: ast,
    };
  }
}

function* typecheckAnnotated<T>(
  ast: TypedAst<T>,
  context: Context,
): Generator<TypeError<TypedAst<T>>> {
  switch (ast.type) {
    case "constant": {
      const t = inferConstant(ast.value);
      yield* unifyNode(ast, ast.$, t);
      return;
    }
    case "ident": {
      const lookup = context[ast.ident];
      if (lookup === undefined) {
        yield { type: "unbound-variable", ident: ast.ident, node: ast };
      } else {
        yield* unifyNode(ast, ast.$, instantiate(lookup));
      }
      return;
    }
    case "abstraction":
      yield* unifyNode(ast, ast.$, ["->", ast.param.$, ast.body.$]);
      yield* typecheckAnnotated(ast.body, {
        ...context,
        [ast.param.name]: ast.param.$,
      });
      return;
    case "application":
      yield* unifyNode(ast, ast.caller.$, ["->", ast.arg.$, ast.$]);
      yield* typecheckAnnotated(ast.caller, context);
      yield* typecheckAnnotated(ast.arg, context);
      return;
    case "let":
      yield* unifyNode(ast, ast.definition.$, ast.binding.$);
      yield* unifyNode(ast, ast.$, ast.body.$);
      yield* typecheckAnnotated(ast.definition, {
        ...context,
        [ast.binding.name]: ast.definition.$,
      });
      yield* typecheckAnnotated(ast.body, {
        ...context,
        [ast.binding.name]: generalize(ast.binding.$, context),
      });
      return;
    case "if":
      yield* unifyNode(ast, ast.condition.$, ["Bool"]);
      yield* unifyNode(ast, ast.$, ast.then.$);
      yield* unifyNode(ast, ast.then.$, ast.else.$);
      yield* typecheckAnnotated(ast.condition, context);
      yield* typecheckAnnotated(ast.then, context);
      yield* typecheckAnnotated(ast.else, context);
      return;
  }
}

export function typecheck<T = {}>(
  ast: UntypedAst<T>,
  context: Context = {},
): [TypedAst<T>, TypeError<TypedAst<T>>[]] {
  TVar.resetId();
  const typedAst = annotate(ast);
  const errors = [...typecheckAnnotated(typedAst, context)];
  return [typedAst, errors];
}

function inferConstant(x: Const): Type {
  if (x === null) {
    return ["Nil"];
  } else if (typeof x === "number") {
    return ["Num"];
  } else if (typeof x === "boolean") {
    return ["Bool"];
  } else if (typeof x === "string") {
    return ["String"];
  } else {
    throw new Error("[unreachable] Invalid type");
  }
}

function annotate<T>(ast: UntypedAst<T>): TypedAst<T> {
  switch (ast.type) {
    case "constant":
    case "ident":
      return {
        ...ast,
        $: TVar.fresh(),
      };
    case "abstraction":
      return {
        ...ast,
        param: { ...ast.param, $: TVar.fresh() },
        body: annotate(ast.body),
        $: TVar.fresh(),
      };
    case "application":
      return {
        ...ast,
        caller: annotate(ast.caller),
        arg: annotate(ast.arg),
        $: TVar.fresh(),
      };
    case "let":
      return {
        ...ast,
        binding: { ...ast.binding, $: TVar.fresh() },
        definition: annotate(ast.definition),
        body: annotate(ast.body),
        $: TVar.fresh(),
      };
    case "if":
      return {
        ...ast,
        condition: annotate(ast.condition),
        then: annotate(ast.then),
        else: annotate(ast.else),
        $: TVar.fresh(),
      };
  }
}
