// Unit tests for src/js/calc/income-tax.js (tax year 2026-27, the page leaves surcharge out by design)
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, close, knownBug } from "./_helpers.mjs";
import { incomeTax, newSlabTax, oldSlabTax } from "../lib/reference.mjs";

const Tax = load("income-tax");

test("new regime slab tax at each band edge (s.202(1): 4/8/12/16/20/24 lakh, 5% steps)", () => {
  const edges = { 400000: 0, 800000: 20000, 1200000: 60000, 1600000: 120000, 2000000: 200000, 2400000: 300000, 3000000: 480000 };
  for (const [income, tax] of Object.entries(edges)) assert.equal(Tax.newRegimeSlabTax(Number(income)), tax, income);
});

test("old regime slab tax at each band edge (2.5/5/10 lakh at 5, 20, 30%)", () => {
  const edges = { 250000: 0, 500000: 12500, 1000000: 112500, 2075000: 435000 };
  for (const [income, tax] of Object.entries(edges)) assert.equal(Tax.oldRegimeSlabTax(Number(income)), tax, income);
});

test("slab tax agrees with the reference at many incomes", () => {
  for (let income = 0; income <= 6000000; income += 37500) {
    close(Tax.newRegimeSlabTax(income), newSlabTax(income), 1e-6, `new ${income}`);
    close(Tax.oldRegimeSlabTax(income), oldSlabTax(income), 1e-6, `old ${income}`);
  }
});

test("the page's worked comparisons", () => {
  // Fresher, 8 lakh, 80C 1.5 lakh, 80D 25,000: old 5.75 lakh taxable -> 27,500 + 4% = 28,600. New 7.25 lakh -> rebate -> 0.
  let t = Tax.compare({ grossSalary: 800000, deduction80C: 150000, deduction80D: 25000 });
  assert.equal(t.old.totalTax, 28600);
  assert.equal(t.new.totalTax, 0);
  assert.equal(t.better, "new");
  assert.equal(t.difference, 28600);
  // Mid-career, 15 lakh, 80C 1.5 lakh, 80D 50,000, HRA 2 lakh: old 1,32,600, new 97,500
  t = Tax.compare({ grossSalary: 1500000, deduction80C: 150000, deduction80D: 50000, hraExemption: 200000 });
  assert.equal(t.old.totalTax, 132600);
  assert.equal(t.new.totalTax, 97500);
  // Senior, 30 lakh, every deduction (8.75 lakh): old 4,52,400, new 4,75,800, old wins by 23,400
  t = Tax.compare({ grossSalary: 3000000, deduction80C: 150000, deduction80D: 75000, hraExemption: 400000, homeLoanInterest: 200000, nps80CCD: 50000 });
  assert.equal(t.old.totalTax, 452400);
  assert.equal(t.new.totalTax, 475800);
  assert.equal(t.better, "old");
  assert.equal(t.difference, 23400);
});

test("new regime rebate: a 12,75,000 salary pays nothing, 12,85,000 pays ₹10,400 after marginal relief", () => {
  assert.equal(Tax.compare({ grossSalary: 1275000 }).new.totalTax, 0);
  const t = Tax.compare({ grossSalary: 1285000 }).new;
  assert.equal(t.taxableIncome, 1210000);
  assert.equal(t.taxBeforeCess, 61500);
  assert.equal(t.rebate, 51500);
  assert.equal(t.totalTax, 10400);
});

test("marginal relief ends where slab tax equals the income above 12 lakh (about 12,70,588)", () => {
  const near = Tax.compare({ grossSalary: 75000 + 1270588 }).new;
  close(near.taxBeforeCess - near.rebate, 70588, 1e-6);
  const past = Tax.compare({ grossSalary: 75000 + 1280000 }).new;
  assert.equal(past.rebate, 0);
  assert.equal(past.totalTax, Math.round(72000 * 1.04));
});

test("old regime rebate: taxable 5 lakh is free, 5,00,010 is not (no marginal relief)", () => {
  assert.equal(Tax.compare({ grossSalary: 550000 }).old.totalTax, 0);
  assert.equal(Tax.compare({ grossSalary: 550010 }).old.totalTax, Math.round(12502 * 1.04));
});

test("standard deduction only against salary, never more than the salary", () => {
  let t = Tax.compare({ otherIncome: 1000000 });
  assert.equal(t.old.stdDeduction, 0);
  assert.equal(t.new.stdDeduction, 0);
  t = Tax.compare({ grossSalary: 40000 });
  assert.equal(t.old.stdDeduction, 40000);
  assert.equal(t.new.stdDeduction, 40000);
  assert.equal(t.new.taxableIncome, 0);
});

test("80C, home loan interest and NPS are capped, new regime ignores all of them", () => {
  const t = Tax.compare({ grossSalary: 2000000, deduction80C: 300000, homeLoanInterest: 350000, nps80CCD: 90000 });
  assert.equal(t.old.deductions, 150000 + 200000 + 50000);
  assert.equal(t.new.taxableIncome, 2000000 - 75000);
});

test("agrees with the reference for a grid of salaries, other income and deductions", () => {
  for (const salary of [0, 300000, 700000, 1275000, 1500000, 2475000, 6000000, 25000000]) {
    for (const other of [0, 450000]) {
      for (const ded of [0, 175000, 800000]) {
        const t = Tax.compare({ grossSalary: salary, otherIncome: other, deduction80C: Math.min(ded, 150000), otherDeductions: Math.max(0, ded - 150000) });
        const o = incomeTax({ salary, otherIncome: other, oldDeductions: ded }, "old");
        const n = incomeTax({ salary, otherIncome: other }, "new");
        assert.equal(t.old.totalTax, Math.round(o.total), `old ${salary}/${other}/${ded}`);
        assert.equal(t.new.totalTax, Math.round(n.total), `new ${salary}/${other}`);
      }
    }
  }
});

test("empty, zero and negative figures give zero tax", () => {
  for (const o of [{}, { grossSalary: 0 }, { grossSalary: -500000 }, { grossSalary: 1200000, deduction80C: -5 }]) {
    const t = Tax.compare(o);
    assert.ok(t.old.totalTax >= 0 && t.new.totalTax >= 0);
  }
  const t = Tax.compare({});
  assert.equal(t.better, "same");
  assert.equal(t.difference, 0);
});

test("a very large income stays finite", () => {
  const t = Tax.compare({ grossSalary: 1e10 });
  assert.ok(Number.isFinite(t.new.totalTax) && t.new.totalTax > 0);
});

knownBug("80D is capped at 1,00,000 (s.126)", "80D is not capped at all", () => {
  assert.equal(Tax.compare({ grossSalary: 2000000, deduction80D: 250000 }).old.deductions, 100000);
});

knownBug("tax above 50 lakh includes surcharge (disclosed limitation)", "no surcharge, as the page says", () => {
  const withSurcharge = incomeTax({ salary: 6000000 }, "new", { withSurcharge: true });
  assert.equal(Tax.compare({ grossSalary: 6000000 }).new.totalTax, Math.round(withSurcharge.total));
});
