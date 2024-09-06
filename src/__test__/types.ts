import { Type } from "../type";

export const int: Type = { tag: "Named", name: "Int", args: [] };
export const bool: Type = { tag: "Named", name: "Bool", args: [] };
export const list = (x: Type): Type => ({
  tag: "Named",
  name: "List",
  args: [x],
});
export const tuple = (...ts: Type[]): Type => ({
  tag: "Named",
  name: "Tuple",
  args: ts,
});
export const maybe = (...ts: Type[]): Type => ({
  tag: "Named",
  name: "Maybe",
  args: ts,
});

export const fn = (args: Type[], return_: Type): Type =>
  args.reduceRight(
    (prev, x) => ({
      tag: "Named",
      name: "->",
      args: [x, prev],
    }),
    return_,
  );
