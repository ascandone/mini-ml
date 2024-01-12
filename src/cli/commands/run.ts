import { readFileSync } from "fs";
import { unsafeParse } from "../../parser";
import { typecheck } from "../../typecheck";
import { typePPrint } from "../../type/pretty-printer";
import { prelude } from "../../prelude";

export function run(path: string) {
  const f = readFileSync(path);
  const untyped = unsafeParse(f.toString());
  const typed = typecheck(untyped, prelude);
  const pt = typePPrint(typed.$);
  console.log(pt);
}
