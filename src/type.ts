export type Type =
  | { tag: "Named"; name: string; args: Type[] }
  | { tag: "Var"; id: number };

export class TypeMismatchError extends Error {}
export class OccursCheckError extends Error {}

export class Unifier {
  private nextId = 0;
  private substitutions = new Map<number, Type>();

  freshVar(): Type & { tag: "Var" } {
    return {
      tag: "Var",
      id: this.nextId++,
    };
  }

  resolve(t: Type): Type {
    t = this.resolveOnce(t);

    if (t.tag === "Var") {
      return t;
    }

    return {
      ...t,
      args: t.args.map((arg) => this.resolve(arg)),
    };
  }

  private resolveOnce(t: Type): Type {
    switch (t.tag) {
      case "Named":
        // TODO recur?
        return t;

      case "Var": {
        const substitution = this.substitutions.get(t.id);
        if (substitution === undefined) {
          return t;
        }
        return this.resolveOnce(substitution);
      }
    }
  }

  /** Pre: t1 is the resolved value */
  private occursCheck(t1: Type & { tag: "Var" }, t2: Type & { tag: "Named" }) {
    for (let arg of t2.args) {
      arg = this.resolveOnce(arg);
      switch (arg.tag) {
        case "Var":
          if (t1.id === arg.id) {
            throw new OccursCheckError();
          }
          break;
        case "Named":
          this.occursCheck(t1, arg);
          break;
      }
    }
  }

  unify(t1: Type, t2: Type) {
    t1 = this.resolveOnce(t1);
    t2 = this.resolveOnce(t2);

    if (t1.tag === "Named" && t2.tag === "Named") {
      if (t1.name !== t2.name || t1.args.length !== t2.args.length) {
        throw new TypeMismatchError();
      }
      for (let i = 0; i < t1.args.length; i++) {
        this.unify(t1.args[i]!, t2.args[i]!);
      }
    } else if (t1.tag === "Var" && t2.tag === "Named") {
      this.occursCheck(t1, t2);
      this.substitutions.set(t1.id, t2);
    } else if (t1.tag === "Named" && t2.tag === "Var") {
      this.unify(t2, t1);
    } else if (t1.tag === "Var" && t2.tag === "Var") {
      if (t1.id === t2.id) {
        return;
      }
      this.substitutions.set(t2.id, t1);
    } else {
      throw new Error("[unreachable]");
    }
  }
}

export class PolyType {
  private t: Type;
  private ctxVars = new Set<number>();

  constructor(
    t: Type,
    private unifier: Unifier,
    context: Type[] = [],
  ) {
    // Note: it would be incorrect to resolve the type
    // while instantiating
    // (and also happens to be possibly less performant)
    this.t = unifier.resolve(t);

    for (const t of context) {
      this.findFreeVars(this.unifier.resolve(t));
    }
  }

  private findFreeVars(t: Type) {
    switch (t.tag) {
      case "Named":
        for (const arg of t.args) {
          this.findFreeVars(arg);
        }
        break;

      case "Var":
        this.ctxVars.add(t.id);
        break;
    }
  }

  instantiate(): Type {
    const instantiatedVars = new Map<Number, number>();

    const instantiateType = (t: Type): Type => {
      switch (t.tag) {
        case "Named":
          return {
            ...t,
            args: t.args.map((arg) => instantiateType(arg)),
          };

        case "Var": {
          // Skip instantiation wheter the var is not free in ctx
          if (this.ctxVars.has(t.id)) {
            return t;
          }

          const previousInstantiation = instantiatedVars.get(t.id);
          if (previousInstantiation !== undefined) {
            return {
              tag: "Var",
              id: previousInstantiation,
            };
          }

          const freshVar = this.unifier.freshVar();
          instantiatedVars.set(t.id, freshVar.id);
          return freshVar;
        }
      }
    };

    return instantiateType(this.t);
  }
}
