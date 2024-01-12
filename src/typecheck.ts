import { Ast, Const } from "./ast";
import { TVar, Type, generalize, instantiate, unify } from "./unify";

export type UntypedAst<T = {}> = Ast<T>;
export type TypedAst<T = {}> = Ast<T & { $: TVar }>;

export class UnboundVariableError<T> extends Error {
  constructor(public name: string, public node: Ast<T>) {
    super(`Unbound variable: ${name}`);
  }
}

export type Context = Record<string, Type>;

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
        throw new UnboundVariableError(ast.ident, ast);
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
      typecheckAnnotated(ast.definition, {
        ...context,
        [ast.binding.name]: ast.definition.$,
      });
      typecheckAnnotated(ast.body, {
        ...context,
        [ast.binding.name]: generalize(ast.binding.$, context),
      });
      return;
    case "if":
      unify(ast.condition.$, ["Bool"]);
      unify(ast.$, ast.then.$);
      unify(ast.then.$, ast.else.$);
      typecheckAnnotated(ast.condition, context);
      typecheckAnnotated(ast.then, context);
      typecheckAnnotated(ast.else, context);
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
