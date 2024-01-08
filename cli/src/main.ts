#!/usr/bin/env node

import { Command } from "commander";
import { run } from "./run";
const packageJson = require("../package.json");

const program = new Command();

program.version(packageJson.version);

program
  .command("infer <path>")
  .description("Infer the type of given file")
  .action((path: string) => {
    run(path);
  });

program.parse();
