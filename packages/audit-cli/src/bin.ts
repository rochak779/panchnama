#!/usr/bin/env node
import { runCli } from "./cli.js";

const result = runCli(process.argv.slice(2));
for (const line of result.lines) {
  console.info(line);
}
process.exit(result.exitCode);
