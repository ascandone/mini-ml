import { Context } from "./typecheck";
import { TVar, Type } from "./unify";

export const prelude: Context = {
  "+": fn(["Num"], ["Num"], ["Num"]),
  "*": fn(["Num"], ["Num"], ["Num"]),
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
