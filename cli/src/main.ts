#!/usr/bin/env node

import { Command } from "commander";
import { run } from "./commands/run";
import { lsp } from "./commands/lsp";
const packageJson = require("../package.json");

const program = new Command();

program.version(packageJson.version);

program
  .command("infer <path>")
  .description("Infer the type of given file")
  .action((path: string) => {
    run(path);
  });

program
  .command("lsp")
  .description("Run the language server")
  .action(() => {
    lsp();
  });

program.parse();
