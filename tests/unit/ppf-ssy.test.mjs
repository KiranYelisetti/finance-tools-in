// Unit tests for src/js/calc/ppf.js and src/js/calc/ssy.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, close, knownBug } from "./_helpers.mjs";
import { ppfBalances, ppfWithdrawalLimit, ssyBalances, ssyWithdrawalAt18 } from "../lib/reference.mjs";

const Ppf = load("ppf");
const Ssy = load("ssy");

test("PPF: 1 lakh a year for 15 years at 7.1% matures at ₹27,12,139.48", () => {
  const r = Ppf.calculate(100000, 15, 7.1);
  close(r.maturityValue, 2712139.48, 0.005);
  assert.equal(r.totalContribution, 1500000);
  close(r.totalInterest, 1212139.48, 0.005);
  close(r.balanceAfter7Years, 929682.44, 0.005);
  assert.equal(r.taxBenefit, 100000);
});

test("PPF agrees with the yearly balance for every period and rate", () => {
  for (const years of [15, 16, 20, 25, 30]) {
    for (const rate of [6.5, 7.1, 8]) {
      for (const deposit of [500, 60000, 150000]) {
        close(Ppf.calculate(deposit, years, rate).maturityValue, ppfBalances(deposit, rate, years)[years], 1e-6, `${deposit} ${years}y ${rate}%`);
      }
    }
  }
});

test("PPF refuses deposits outside 500 to 1,50,000, periods under 15 years and missing figures", () => {
  assert.equal(Ppf.calculate(499, 15, 7.1), null);
  assert.equal(Ppf.calculate(150001, 15, 7.1), null);
  assert.equal(Ppf.calculate(100000, 14, 7.1), null);
  assert.equal(Ppf.calculate(100000, NaN, 7.1), null);
  assert.equal(Ppf.calculate(100000, 15, 0), null);
  assert.equal(Ppf.calculate(0, 15, 7.1), null);
  assert.ok(Ppf.calculate(500, 15, 7.1));
  assert.ok(Ppf.calculate(150000, 15, 7.1));
});

knownBug("PPF partial withdrawal follows paragraph 9(1) of the PPF Scheme, 2019",
  "uses 50% of the year-7 balance instead of 50% of the lower of the balances 4 years back and last year", () => {
    const b = ppfBalances(100000, 7.1, 15);
    close(Ppf.calculate(100000, 15, 7.1).partialWithdrawal, ppfWithdrawalLimit(b, 8), 1);
  });

knownBug("PPF tax saving in the 30% slab includes the 4% cess", "shows 30% instead of 31.2%", () => {
  close(Ppf.calculate(100000, 15, 7.1).taxSavings, 31200, 0.5);
});

test("SSY: a 5-year-old, 1 lakh a year at 8.2%, matures at ₹47,88,079.45", () => {
  const r = Ssy.calculate(5, 100000, 8.2);
  close(r.maturityValue, 4788079.45, 0.005);
  assert.equal(r.totalInvestment, 1500000);
  assert.equal(r.depositEndAge, 20);
  assert.equal(r.maturityAge, 26);
});

test("SSY agrees with the yearly balance for every age 0 to 10", () => {
  for (let age = 0; age <= 10; age++) {
    for (const [deposit, rate] of [[250, 7.6], [100000, 8.2], [150000, 8.8]]) {
      const b = ssyBalances(deposit, rate);
      const r = Ssy.calculate(age, deposit, rate);
      close(r.maturityValue, b[21], 1e-6, `age ${age}`);
      close(r.partialWithdrawal, ssyWithdrawalAt18(b, age), 1e-6, `withdrawal at 18, age ${age}`);
    }
  }
});

test("SSY refuses ages outside 0 to 10 and deposits outside 250 to 1,50,000", () => {
  assert.equal(Ssy.calculate(-1, 100000, 8.2), null);
  assert.equal(Ssy.calculate(11, 100000, 8.2), null);
  assert.equal(Ssy.calculate(5, 249, 8.2), null);
  assert.equal(Ssy.calculate(5, 150001, 8.2), null);
});

knownBug("SSY withdrawal at 18 works for a part-year age", "age + year === 18 never matches 5.5, so it is 0", () => {
  assert.ok(Ssy.calculate(5.5, 100000, 8.2).partialWithdrawal > 0);
});
