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

  static quantified(id: number): TVar {
    return new TVar({ type: "quantified", id });
  }

  resolve(): TVarResolution {
    if (this.value.type === "linked") {
      return this.value.to.resolve();
    }

    return this.value;
  }

  private static unboundId = 0;
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
        TVar.unify(rest1[i]!, rest2[i]!);
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

    if (r1.type === "unbound" && r2.type === "unbound" && r1.id === r2.id) {
      // TVars are already linked
      return;
    }

    $2.value = { type: "linked", to: $1 };
  }
}

export class UnifyError extends Error {
  constructor(err: string, public left: Type, public right: Type) {
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

  if (resolvedV.id === resolvedX.id) {
    throw new UnifyError("Occurs check", v, x);
  }
}

export type Context = Record<string, Type>;

function* getTypeFreeVars(t: Type): Generator<number> {
  if (t instanceof TVar) {
    const resolved = t.resolve();
    if (resolved.type === "unbound") {
      yield resolved.id;
    }
    return;
  }

  if (isConcrete(t)) {
    const [, ...args] = t;
    for (const arg of args) {
      yield* getTypeFreeVars(arg);
    }
    return;
  }
}

/** Returns the set of ids of free vars in a context  */
function getContextFreeVars(context: Context): Set<number> {
  const s = new Set<number>();
  for (const t of Object.values(context)) {
    for (const id of getTypeFreeVars(t)) {
      s.add(id);
    }
  }
  return s;
}

export function generalize(t: Type, context: Context = {}): Type {
  const ctxFreeVars = getContextFreeVars(context);
  let nextId = 0;
  const bound = new Map<number, number>();

  function recur(t: Type): Type {
    if (!(t instanceof TVar)) {
      const [name, ...args] = t;
      return [name, ...args.map(recur)];
    }

    const resolvedT = t.resolve();
    switch (resolvedT.type) {
      case "quantified":
        throw new Error("[unreachable] cannot generalize polytype");
      case "bound":
        return recur(resolvedT.value);
      case "unbound": {
        if (ctxFreeVars.has(resolvedT.id)) {
          return t;
        }

        const thisId = bound.get(resolvedT.id) ?? nextId++;
        bound.set(resolvedT.id, thisId);
        return TVar.quantified(thisId);
      }
    }
  }

  return recur(t);
}

export function instantiate(t: Type): Type {
  const instantiated = new Map<number, TVar>();

  function recur(t: Type): Type {
    if (!(t instanceof TVar)) {
      const [name, ...args] = t;
      return [name, ...args.map(recur)];
    }

    const resolvedT = t.resolve();
    switch (resolvedT.type) {
      case "bound":
      case "unbound":
        return t;
      case "quantified": {
        const lookup = instantiated.get(resolvedT.id);
        if (lookup === undefined) {
          const fresh = TVar.fresh();
          instantiated.set(resolvedT.id, fresh);
          return fresh;
        }
        return lookup;
      }
    }
  }

  return recur(t);
}
