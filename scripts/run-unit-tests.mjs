#!/usr/bin/env node
// Runs every tests/unit/*.test.mjs file with Node's built-in test runner (node --test). No browser needed.
// Listing the files here keeps `npm test` working the same way on every Node version from 20 up and on Windows,
// where the shell does not expand globs.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../tests/unit/", import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.mjs")).sort().map((f) => path.join(dir, f));
if (!files.length) {
  console.error("No unit tests found in tests/unit");
  process.exit(1);
}
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
