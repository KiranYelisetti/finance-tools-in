// Unit tests for src/js/calc/emi-prepayment.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, close, knownBug } from "./_helpers.mjs";
import { emi, amortise } from "../lib/reference.mjs";

const Pre = load("emi-prepayment");

function reference({ principal, annualRate, tenureYears, monthlyExtra = 0, lumpSum = 0 }) {
  const n = tenureYears * 12;
  const e = emi(principal, annualRate, n);
  const pre = amortise({ principal, annualPct: annualRate, emi: e, maxMonths: 2 * n, extraMonthly: monthlyExtra, lumpAtStart: lumpSum });
  return { e, n, pre, plainInterest: e * n - principal };
}

test("no prepayment: nothing saved, the original tenure", () => {
  const r = Pre.calculate({ principal: 5000000, annualRate: 9, tenureYears: 20 });
  assert.equal(r.months, 240);
  assert.equal(r.monthsSaved, 0);
  assert.equal(r.interestSaved, 0);
  assert.equal(r.totalSaved, 0);
  close(r.emi, emi(5000000, 9, 240));
  close(r.origTotalInterest, r.emi * 240 - 5000000);
});

const plans = [
  { principal: 5000000, annualRate: 9, tenureYears: 20, monthlyExtra: 10000 },
  { principal: 2500000, annualRate: 8.5, tenureYears: 15, lumpSum: 300000 },
  { principal: 2500000, annualRate: 8.5, tenureYears: 15, monthlyExtra: 5000, lumpSum: 300000 },
  { principal: 300000, annualRate: 18, tenureYears: 3, monthlyExtra: 1000, lumpSum: 50000 },
  { principal: 50000000, annualRate: 20, tenureYears: 30, monthlyExtra: 100000 },
];
for (const plan of plans) {
  test(`matches a month-by-month schedule: ${JSON.stringify(plan)}`, () => {
    const r = Pre.calculate(plan);
    const ref = reference(plan);
    assert.equal(r.months, ref.pre.months);
    close(r.totalInterestWithPrepay, ref.pre.interest, 0.01);
    close(r.totalPaidWithPrepay, ref.pre.paid, 0.01);
    close(r.interestSaved, ref.plainInterest - ref.pre.interest, 0.01);
    assert.equal(r.monthsSaved, ref.n - ref.pre.months);
  });
}

test("total saved equals interest saved (the principal is the same either way)", () => {
  const r = Pre.calculate(plans[2]);
  close(r.totalSaved, r.interestSaved, 1e-4);
});

test("zero or negative loan, rate or tenure gives no result", () => {
  for (const bad of [{ principal: 0 }, { principal: -100 }, { annualRate: 0 }, { tenureYears: 0 }, { annualRate: -1 }]) {
    assert.equal(Pre.calculate({ principal: 100000, annualRate: 9, tenureYears: 5, ...bad }), null, JSON.stringify(bad));
  }
});

test("a lump sum equal to the loan closes it at once", () => {
  const r = Pre.calculate({ principal: 1000000, annualRate: 9, tenureYears: 10, lumpSum: 1000000 });
  assert.equal(r.months, 0);
  assert.equal(r.totalInterestWithPrepay, 0);
  assert.equal(r.totalPaidWithPrepay, 1000000);
});

test("duration text", () => {
  assert.equal(Pre.durationText(0), "0 months");
  assert.equal(Pre.durationText(1), "1 month");
  assert.equal(Pre.durationText(12), "1 year");
  assert.equal(Pre.durationText(13), "1 year 1 month");
  assert.equal(Pre.durationText(76), "6 years 4 months");
});

knownBug("a lump sum larger than the loan counts only what was owed", "total paid shows the whole lump sum", () => {
  const r = Pre.calculate({ principal: 5000000, annualRate: 9, tenureYears: 20, lumpSum: 6000000 });
  assert.equal(r.totalPaidWithPrepay, 5000000);
});
