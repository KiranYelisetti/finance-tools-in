#!/usr/bin/env node
// Tests for src/js/number-words.js. Run: npm test (also runs in the deploy workflow before the build).
// The cases live in tests/lib/number-words-cases.mjs, so the end-to-end suite types the same ones into the real page.
// Expected values are worked out by hand. Many inputs are real Search Console queries for /number-to-words/.
import { createRequire } from "node:module";
import { cases, errorCases, inUnitCases } from "../tests/lib/number-words-cases.mjs";

const require = createRequire(import.meta.url);
const NW = require("../src/js/number-words.js");

let fails = 0;
let count = 0;
function check(input, expect) {
  count += 1;
  const r = NW.convert(input);
  for (const [k, v] of Object.entries(expect)) {
    const got = typeof r[k] === "bigint" ? r[k].toString() : r[k];
    if (got !== v) {
      fails += 1;
      console.log(`FAIL ${JSON.stringify(input)} ${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(got)}`);
    }
  }
}

for (const [input, expect] of cases) check(input, expect);

// Limits and errors
for (const bad of errorCases) {
  count += 1;
  const r = NW.convert(bad);
  if (!r.error) { fails += 1; console.log(`FAIL ${JSON.stringify(bad)}: expected an error, got ${JSON.stringify(r.indianGrouped)}`); }
}
count += 1;
if (!NW.convert("").empty) { fails += 1; console.log("FAIL empty input should be empty"); }

// inUnit, used by the lakh crore table
for (const [rupees, exp, want] of inUnitCases) {
  count += 1;
  const got = NW.inUnit(BigInt(rupees), exp);
  if (got !== want) { fails += 1; console.log(`FAIL inUnit(${rupees}, ${exp}): expected ${want}, got ${got}`); }
}

console.log(`number-words: ${count} cases, ${fails} failures`);
process.exit(fails ? 1 : 0);
