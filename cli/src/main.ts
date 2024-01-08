#!/usr/bin/env node

import { readFileSync } from "fs";
import { exit } from "process";
import { unsafeParse, typePPrint, typecheck, prelude } from "@mini-ml/core";

const [, , path] = process.argv;

if (path === undefined) {
  console.error("path argument required!");
  exit(1);
}

const f = readFileSync(path);

const untyped = unsafeParse(f.toString());

const typed = typecheck(untyped, prelude);

const pt = typePPrint(typed.$);
console.log(pt);
