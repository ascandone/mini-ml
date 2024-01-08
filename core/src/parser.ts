import type {
  MatchResult,
  NonterminalNode,
  Node as OhmNode,
  TerminalNode,
} from "ohm-js";
import grammar from "./parser/grammar.ohm-bundle";
import { Ast } from "./ast";
import { UntypedAst } from "./typecheck";

export type Span = [startIdx: number, endIdx: number];

export type SpannedAst<T = {}> = Ast<T & { span: Span }>;

function getSpan({ source }: OhmNode): Span {
  return [source.startIdx, source.endIdx];
}

const semantics = grammar.createSemantics();

function infixOp(
  this: NonterminalNode,
  left: NonterminalNode,
  op: TerminalNode,
  right: NonterminalNode
): SpannedAst {
  return {
    type: "application",
    caller: {
      type: "application",
      caller: {
        type: "ident",
        ident: op.sourceString,
        span: getSpan(op),
      },
      arg: left.expr(),
      span: getSpan(this),
    },
    arg: right.expr(),
    span: getSpan(this),
  };
}

semantics.addOperation<number>("number()", {
  number_whole(node) {
    return Number(node.sourceString);
  },

  number_fract(_intPart, _comma, _floatPart) {
    return Number(this.sourceString);
  },

  number_neg(_minus, node) {
    return -node.number();
  },
});

semantics.addOperation<SpannedAst>("expr()", {
  PriExp_let(_let, ident, _eq, def, _in, body) {
    return {
      type: "let",
      binding: { name: ident.sourceString, span: getSpan(ident) },
      definition: def.expr(),
      body: body.expr(),
      span: getSpan(this),
    };
  },

  PriExp_abs(_fn, params, _arrow, body) {
    return params.children.reduceRight(
      (prev, param) => ({
        type: "abstraction",
        param: {
          name: param!.sourceString,
          span: getSpan(param!),
        },
        body: prev,
        span: getSpan(this),
      }),
      body.expr() as SpannedAst
    );
  },

  ExpExp_appl(items) {
    const [first, ...other] = items.children;
    return other.reduce<SpannedAst>(
      (acc, node) => ({
        type: "application",
        caller: acc,
        arg: node.expr(),
        span: getSpan(this),
      }),
      first!.expr()
    );
  },

  PriExp_paren(_l, arg1, _r) {
    return arg1.expr();
  },

  ident(_l, _ns) {
    return {
      type: "ident",
      ident: this.sourceString,
      span: getSpan(this),
    };
  },

  number(node) {
    return {
      type: "constant",
      value: node.number(),
      span: getSpan(this),
    };
  },

  EqExpr_eq: infixOp,
  EqExpr_neq: infixOp,
  CompExp_lte: infixOp,
  CompExp_lt: infixOp,
  CompExp_gt: infixOp,
  CompExp_gte: infixOp,
  AddExp_plus: infixOp,
  AddExp_minus: infixOp,
  MulExp_times: infixOp,
  MulExp_divide: infixOp,
  MulExp_rem: infixOp,
  ExpExp_power: infixOp,
  OrExpr_or: infixOp,
  AndExpr_and: infixOp,
});

semantics.addOperation<UntypedAst[]>("parse()", {
  MAIN_expr(a) {
    return a.expr();
  },
});

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; matchResult: MatchResult };

export function parse(input: string): ParseResult<SpannedAst> {
  const matchResult = grammar.match(input);
  if (matchResult.failed()) {
    return { ok: false, matchResult };
  }

  return { ok: true, value: semantics(matchResult).parse() };
}

export function unsafeParse(input: string): SpannedAst {
  const res = parse(input);
  if (res.ok) {
    return res.value;
  }

  throw new Error(res.matchResult.message!);
}
