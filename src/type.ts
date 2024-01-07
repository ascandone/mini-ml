export type Ref<T> = { ref: T };

export type Type = TVar | [string, ...Type[]];

export type TVarResolution =
  | { type: "unbound"; id: number }
  | { type: "bound"; value: Type }
  | { type: "quantified"; id: number };

export class TVar {
  private constructor(
    private value: TVarResolution | { type: "linked"; to: TVar }
  ) {}

  static fresh(): TVar {
    return new TVar({ type: "unbound", id: TVar.unboundId++ });
  }

  resolve(): TVarResolution {
    if (this.value.type === "linked") {
      return this.value.to.resolve();
    }

    return this.value;
  }

  private static unboundId: number;
  static resetId() {
    TVar.unboundId = 0;
  }

  static unify(t1: Type, t2: Type) {
    if (isConcrete(t1) && isConcrete(t2)) {
      const [n1, ...rest1] = t1;
      const [n2, ...rest2] = t2;

      if (n1 !== n2 || rest1.length !== rest2.length) {
        throw new UnifyError("Types do not match", t1, t2);
      }

      for (let i = 0; i < rest1.length; i++) {
        this.unify(rest1[i]!, rest2[i]!);
      }
    } else if (t1 instanceof TVar && isConcrete(t2)) {
      occursCheck(t1, t2);

      switch (t1.value.type) {
        case "bound":
          unify(t1.value.value, t2);
          break;
        case "unbound":
          t1.value = { type: "bound", value: t2 };
          break;
        case "linked":
          unify(t1.value.to, t2);
          break;
        case "quantified":
          throw new Error("[unreachable] Cannot unify polytypes");
      }
    } else if (isConcrete(t1) && t2 instanceof TVar) {
      unify(t2, t1);
    } else if (t1 instanceof TVar && t2 instanceof TVar) {
      TVar.unifyTVars(t1, t2);
    }
  }

  private static unifyTVars($1: TVar, $2: TVar) {
    const r1 = $1.resolve();
    if (r1.type === "bound") {
      unify($2, r1.value);
      return;
    }

    const r2 = $2.resolve();
    if (r2.type === "bound") {
      unify($1, r2.value);
      return;
    }

    if ($2.value.type === "linked") {
      unify($2.value.to, $1);
      return;
    }

    $2.value = { type: "linked", to: $1 };
  }
}

export class UnifyError extends Error {
  constructor(err: string, public left: Type, right: Type) {
    super(err);
  }
}

function isConcrete(t1: Type): t1 is [string, ...Type[]] {
  return Array.isArray(t1);
}

export const unify = TVar.unify;

// Occurs check on monotypes
function occursCheck(v: TVar, x: Type) {
  if (isConcrete(x)) {
    const [, ...nested] = x;
    for (const t of nested) {
      occursCheck(v, t);
    }
    return;
  }

  const resolvedV = v.resolve();
  if (resolvedV.type === "quantified") {
    throw new Error("[unreachable]");
  }
  if (resolvedV.type === "bound") {
    return;
  }

  if (!(x instanceof TVar)) {
    throw new Error("[unreachable]");
  }

  const resolvedX = x.resolve();
  if (resolvedX.type === "quantified") {
    throw new Error("[unreachable]");
  }
  if (resolvedX.type === "bound") {
    return;
  }

  if (resolvedV.id === resolvedV.id) {
    throw new UnifyError("Occurs check", v, x);
  }
}
