import { Ast, Const } from "./ast";
import { Unifier } from "./type";
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

export class Analysis<T> {
  errors: TypeError<TypedAst<T>>[] = [];

  public typedAst: TypedAst<T>;
  constructor(untypedAst: UntypedAst<T>, context: Context = {}) {
    this.typedAst = annotate(untypedAst);
    this.typecheckAnnotated(this.typedAst, context);
  }

  private unifyNode(ast: TypedAst<T>, t1: Type, t2: Type) {
    try {
      unify(t1, t2);
    } catch (e) {
      if (!(e instanceof UnifyError)) {
        throw e;
      }
      this.errors.push({
        type: e.error,
        left: e.left,
        right: e.right,
        node: ast,
      });
    }
  }

  private typecheckAnnotated(ast: TypedAst<T>, context: Context) {
    switch (ast.type) {
      case "constant": {
        const t = inferConstant(ast.value);
        this.unifyNode(ast, ast.$, t);
        return;
      }
      case "ident": {
        const lookup = context[ast.ident];
        if (lookup === undefined) {
          this.errors.push({
            type: "unbound-variable",
            ident: ast.ident,
            node: ast,
          });
        } else {
          this.unifyNode(ast, ast.$, instantiate(lookup));
        }
        return;
      }
      case "abstraction":
        this.unifyNode(ast, ast.$, ["->", ast.param.$, ast.body.$]);
        this.typecheckAnnotated(ast.body, {
          ...context,
          [ast.param.name]: ast.param.$,
        });
        return;
      case "application":
        this.unifyNode(ast, ast.caller.$, ["->", ast.arg.$, ast.$]);
        this.typecheckAnnotated(ast.caller, context);
        this.typecheckAnnotated(ast.arg, context);
        return;
      case "let":
        this.unifyNode(ast, ast.definition.$, ast.binding.$);
        this.unifyNode(ast, ast.$, ast.body.$);
        this.typecheckAnnotated(ast.definition, {
          ...context,
          [ast.binding.name]: ast.definition.$,
        });
        this.typecheckAnnotated(ast.body, {
          ...context,
          [ast.binding.name]: generalize(ast.binding.$, context),
        });
        return;
      case "if":
        this.unifyNode(ast, ast.condition.$, ["Bool"]);
        this.unifyNode(ast, ast.$, ast.then.$);
        this.unifyNode(ast, ast.then.$, ast.else.$);
        this.typecheckAnnotated(ast.condition, context);
        this.typecheckAnnotated(ast.then, context);
        this.typecheckAnnotated(ast.else, context);
        return;
    }
  }
}

export function typecheck<T = {}>(
  ast: UntypedAst<T>,
  context: Context = {},
): [TypedAst<T>, TypeError<TypedAst<T>>[]] {
  TVar.resetId();
  const typedAst = annotate(ast);
  const typechecker = new Analysis<T>(typedAst, context);
  return [typedAst, typechecker.errors];
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
