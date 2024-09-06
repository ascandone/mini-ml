import { Type } from "../type";

function putParens(s: string, needsParens: boolean): string {
  if (needsParens) {
    return `(${s})`;
  }

  return s;
}

export function typePPrint(t: Type): string {
  switch (t.tag) {
    case "Named":
      if (t.args.length === 0) {
        return t.name;
      }

      if (t.name === "->") {
        const [l, r] = t.args;
        if (l === undefined || r === undefined) {
          throw new Error("Invalid arity for arrow type");
        }
        const arg = putParens(
          typePPrint(l),
          l.tag === "Named" && l.name === "->",
        );
        const ret = typePPrint(r);
        return `${arg} -> ${ret}`;
      }

      const args = t.args
        .map((arg) => {
          const inner = typePPrint(arg);
          return putParens(inner, arg.tag === "Named" && arg.args.length !== 0);
        })
        .join(" ");

      return `${t.name} ${args}`;

    case "Var":
      return `t${t.id}`;
  }
}
