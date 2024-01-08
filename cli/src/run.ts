import { prelude, typePPrint, typecheck, unsafeParse } from "@mini-ml/core";
import { readFileSync } from "fs";

export function run(path: string) {
  const f = readFileSync(path);

  const untyped = unsafeParse(f.toString());

  const typed = typecheck(untyped, prelude);

  const pt = typePPrint(typed.$);
  console.log(pt);
}
