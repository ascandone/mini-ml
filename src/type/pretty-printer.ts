import { TVar, Type } from "../unify";

export function typePPrint(t: Type): string {
  if (t instanceof TVar) {
    const resolved = t.resolve();
    switch (resolved.type) {
      case "unbound":
        return `t${resolved.id}`;
      case "bound":
        return typePPrint(resolved.value);
      case "quantified":
        throw new Error("Cannot pprint polytypes");
    }
  }

  const [name, ...args] = t;

  if (name === "->") {
    const [left, right] = args as [Type, Type];
    const needsParens = !(left instanceof TVar) && left[0] === "->";
    const ppLeft = needsParens ? `(${typePPrint(left)})` : typePPrint(left);
    return `${ppLeft} -> ${typePPrint(right)}`;
  } else {
    const ret: string[] = [name];
    for (const arg of args) {
      const s = typePPrint(arg);
      ret.push(" ");
      const needsParens = !(arg instanceof TVar) && arg.length > 1;
      ret.push(needsParens ? `(${s})` : s);
    }
    return ret.join("");
  }
}
