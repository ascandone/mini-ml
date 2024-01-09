import { Context } from "./typecheck";
import { TVar, Type, generalize, unify } from "./unify";

export const prelude: Context = {
  "+": fn(["Num"], ["Num"], ["Num"]),
  "-": fn(["Num"], ["Num"], ["Num"]),
  "*": fn(["Num"], ["Num"], ["Num"]),
  "/": fn(["Num"], ["Num"], ["Num"]),
  "^": fn(["Num"], ["Num"], ["Num"]),
  "%": fn(["Num"], ["Num"], ["Num"]),
  "||": fn(["Bool"], ["Bool"], ["Bool"]),
  "&&": fn(["Bool"], ["Bool"], ["Bool"]),
  "==": gen(([$a]) => fn($a!, $a!, ["Bool"])),
  "!=": gen(([$a]) => fn($a!, $a!, ["Bool"])),
  ">": gen(([$a]) => fn($a!, $a!, ["Bool"])),
  ">=": gen(([$a]) => fn($a!, $a!, ["Bool"])),
  "<": gen(([$a]) => fn($a!, $a!, ["Bool"])),
  "<=": gen(([$a]) => fn($a!, $a!, ["Bool"])),

  negate: fn(["Num"], ["Num"]),
  not: fn(["Bool"], ["Bool"]),
  true: ["Bool"],
  false: ["Bool"],
  unit: ["Unit"],
};

function fn(t1: Type, t2: Type, ...types: Type[]): Type {
  const [first, ...rest] = types;
  if (first === undefined) {
    return ["->", t1, t2];
  } else {
    return ["->", t1, fn(t2, first, ...rest)];
  }
}

function gen(f: (args: Generator<TVar>) => Type): Type {
  function* freshVars() {
    while (true) {
      yield TVar.fresh();
    }
  }
  const t = f(freshVars());
  return generalize(t);
}
