import { Ast, Const } from "./ast";
import { TVar, Type, generalize, instantiate, unify } from "./unify";

export type UntypedAst<T = {}> = Ast<T>;
export type TypedAst<T = {}> = Ast<T & { $: TVar }>;

export class UnboundVariableError extends Error {
  constructor(public name: string) {
    super(`Unbound variable: ${name}`);
  }
}

type Context = Record<string, Type>;

function typecheckAnnotated<T>(ast: TypedAst<T>, context: Context) {
  switch (ast.type) {
    case "constant": {
      const t = inferConstant(ast.value);
      unify(ast.$, t);
      return;
    }
    case "ident": {
      const lookup = context[ast.ident];
      if (lookup === undefined) {
        throw new UnboundVariableError(ast.ident);
      }
      unify(ast.$, instantiate(lookup));
      return;
    }
    case "abstraction":
      unify(ast.$, ["->", ast.param.$, ast.body.$]);
      typecheckAnnotated(ast.body, {
        ...context,
        [ast.param.name]: ast.param.$,
      });
      return;
    case "application":
      unify(ast.caller.$, ["->", ast.arg.$, ast.$]);
      typecheckAnnotated(ast.caller, context);
      typecheckAnnotated(ast.arg, context);
      return;
    case "let":
      unify(ast.definition.$, ast.binding.$);
      unify(ast.$, ast.body.$);

      typecheckAnnotated(ast.definition, context);
      typecheckAnnotated(ast.body, {
        ...context,
        [ast.binding.name]: generalize(ast.binding.$),
      });
      return;
  }
}

export function typecheck<T = {}>(
  ast: UntypedAst<T>,
  context: Context = {}
): TypedAst<T> {
  TVar.resetId();
  const typedAst = annotate(ast);
  typecheckAnnotated(typedAst, context);
  return typedAst;
}

function inferConstant(x: Const): Type {
  if (x === null) {
    return ["Unit"];
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
  }
}
