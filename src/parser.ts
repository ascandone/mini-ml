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

function infixOp(ident: string) {
  return function (
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
          ident,
          span: getSpan(op),
        },
        arg: left.expr(),
        span: getSpan(this),
      },
      arg: right.expr(),
      span: getSpan(this),
    };
  };
}

function prefixOp(ident: string) {
  return function (
    this: NonterminalNode,
    op: TerminalNode,
    x: NonterminalNode
  ): SpannedAst {
    return {
      type: "application",
      caller: {
        type: "ident",
        ident,
        span: getSpan(op),
      },
      arg: x.expr(),
      span: getSpan(this),
    };
  };
}

semantics.addOperation<SpannedAst>("expr()", {
  Exp_let(_let, ident, _eq, def, _in, body) {
    return {
      type: "let",
      binding: { name: ident.sourceString, span: getSpan(ident) },
      definition: def.expr(),
      body: body.expr(),
      span: getSpan(this),
    };
  },

  Exp_abs(_fn, param, _arrow, body) {
    return {
      type: "abstraction",
      param: { name: param.sourceString, span: getSpan(param) },
      body: body.expr(),
      span: getSpan(this),
    };
  },

  Exp_appl(items) {
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

  AddExp_plus: infixOp("+"),
  AddExp_minus: infixOp("-"),
  MulExp_times: infixOp("*"),
  PriExp_neg: prefixOp("negate"),

  ident(_l, _ns) {
    return {
      type: "ident",
      ident: this.sourceString,
      span: getSpan(this),
    };
  },
  number(_) {
    return {
      type: "constant",
      value: Number(this.sourceString),
      span: getSpan(this),
    };
  },
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
