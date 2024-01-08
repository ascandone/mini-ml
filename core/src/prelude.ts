import { Context } from "./typecheck";
import { TVar, Type } from "./unify";

const plusOp = fn(["Num"], ["Num"], ["Num"]);
const multOp = fn(["Num"], ["Num"], ["Num"]);

export const prelude: Context = {
  "+": plusOp,
  "*": multOp,
};

function fn(t1: Type, t2: Type, ...types: Type[]): Type {
  const [first, ...rest] = types;
  if (first === undefined) {
    return ["->", t1, t2];
  } else {
    return ["->", t1, fn(t2, first, ...rest)];
  }
}
