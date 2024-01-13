import { TVar, Type, generalize } from "../unify";
import { TypeError } from "../typecheck";

function pprintHelper(t: Type): string {
  if (t instanceof TVar) {
    const resolved = t.resolve();
    switch (resolved.type) {
      case "quantified":
        return `t${resolved.id}`;
      case "bound":
        return pprintHelper(resolved.value);
      case "unbound":
        throw new Error("[unreachable]");
    }
  }

  const [name, ...args] = t;

  if (name === "->") {
    const [left, right] = args as [Type, Type];
    const needsParens = !(left instanceof TVar) && left[0] === "->";
    const ppLeft = needsParens ? `(${pprintHelper(left)})` : pprintHelper(left);
    return `${ppLeft} -> ${pprintHelper(right)}`;
  } else {
    const ret: string[] = [name];
    for (const arg of args) {
      const s = pprintHelper(arg);
      ret.push(" ");
      const needsParens = !(arg instanceof TVar) && arg.length > 1;
      ret.push(needsParens ? `(${s})` : s);
    }
    return ret.join("");
  }
}

export function typePPrint(t: Type): string {
  return pprintHelper(generalize(t));
}

export function typeErrorPPrint(e: TypeError<unknown>) {
  switch (e.type) {
    case "unbound-variable":
      return `Unbound variable: "${e.ident}"`;

    case "occurs-check":
      return "Cannot construct the infinite type";
    case "type-mismatch":
      return `Type mismatch

Expected:  ${typePPrint(e.left)}
     Got:  ${typePPrint(e.right)}
`;
  }
}
