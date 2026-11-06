// Unit tests for src/js/calc/home-loan.js. The module is not wired into the page yet; these tests pin it to the
// maths the page's inline script and src/_data/homeLoan.js use today, so wiring it in cannot change a figure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { load, close } from "./_helpers.mjs";
import { emi, amortise } from "../lib/reference.mjs";

const require = createRequire(import.meta.url);
const Home = load("home-loan");
const data = require("../../src/_data/homeLoan.js");
const inr = (x) => Math.round(x).toLocaleString("en-IN");

test("50 lakh at 8.5% for 20 years: EMI ₹43,391.16", () => {
  close(Home.emi(5000000, 8.5, 240), 43391.16, 0.005);
  const s = Home.summary(5000000, 8.5, 20);
  assert.equal(s.tenureMonths, 240);
  close(s.totalAmount, s.emi * 240);
  close(s.totalInterest, s.emi * 240 - 5000000);
  assert.equal(s.principalShare, 48);
  assert.equal(s.interestShare, 52);
  close(s.emiPerLakh, s.emi / 50);
});

test("EMI agrees with the present-value formula", () => {
  for (const [P, rate, years] of [[100000, 5, 1], [100000000, 15, 30], [2500000, 9.15, 7], [7500000, 8.75, 25]]) {
    close(Home.emi(P, rate, years * 12), emi(P, rate, years * 12), 1e-6);
  }
});

test("0% interest: EMI is the loan divided by the months, but the page shows nothing for 0%", () => {
  assert.equal(Home.emi(1200000, 0, 120), 10000);
  assert.equal(Home.summary(1200000, 0, 10), null);
});

test("zero, negative or empty inputs give no summary", () => {
  for (const [P, r, y] of [[0, 8.5, 20], [-1, 8.5, 20], [5000000, -1, 20], [5000000, 8.5, 0], [NaN, 8.5, 20]]) {
    assert.equal(Home.summary(P, r, y), null);
  }
});

test("the EMI table on the page (src/_data/homeLoan.js) comes out the same", () => {
  for (const row of data.rows) {
    const P = Number(row.label.replace(/[₹,]/g, "").replace(/ lakh$/, "e5").replace(/ crore$/, "e7"));
    row.emis.forEach((shown, i) => assert.equal(inr(Home.emi(P, data.rate, data.tenures[i] * 12)), shown, `${row.label} ${data.tenures[i]} years`));
  }
});

test("the three worked examples, including the prepayment one, come out the same", () => {
  const inputs = [
    { principal: 50e5, rate: 8.6, years: 20, prepay: 1e5, startYear: 3 },
    { principal: 1e7, rate: 8.75, years: 25 },
    { principal: 35e5, rate: 8.4, years: 15 },
  ];
  inputs.forEach((x, i) => {
    const ex = data.examples[i];
    const plain = Home.schedule(x.principal, x.rate, x.years);
    assert.equal(inr(plain.emi), ex.emi);
    assert.equal(inr(plain.interest), ex.interest);
    if (x.prepay) {
      const pre = Home.withYearlyPrepayment(x.principal, x.rate, x.years, x.prepay, x.startYear);
      const pre2 = Home.schedule(x.principal, x.rate, x.years, x.prepay, x.startYear);
      assert.equal(inr(plain.interest - pre2.interest), ex.saved);
      assert.equal(pre.yearsSaved.toFixed(1), ex.yearsEarly);
      close(pre.interestSaved, plain.interest - pre2.interest, 1);
    }
  });
});

test("yearly prepayment agrees with an independent month-by-month schedule", () => {
  for (const [P, rate, years, amount, fromYear] of [[5000000, 8.6, 20, 100000, 3], [2000000, 9, 15, 250000, 1], [3000000, 9, 25, 50000, 5], [2000000, 9, 15, 5000000, 1]]) {
    const e = emi(P, rate, years * 12);
    const ref = amortise({ principal: P, annualPct: rate, emi: e, maxMonths: years * 12, yearly: { amount, fromYear } });
    const got = Home.withYearlyPrepayment(P, rate, years, amount, fromYear);
    assert.equal(got.months, ref.months, `${P} ${rate}% ${years}y, ${amount} from year ${fromYear}`);
    close(got.interestPaid, ref.interest, 0.01);
  }
});

test("a prepayment of zero changes nothing", () => {
  const p = Home.withYearlyPrepayment(5000000, 8.5, 20, 0, 2);
  close(p.interestSaved, 0, 0.01);
  assert.equal(p.months, 240);
});

test("first-year deductions: interest capped at 2,00,000 (s.22), principal at 1,50,000 (s.123)", () => {
  const d = Home.yearOneDeductions(5000000, 8.5, 20);
  const e = emi(5000000, 8.5, 240);
  const ref = amortise({ principal: 5000000, annualPct: 8.5, emi: e, maxMonths: 240 }).yearOne;
  close(d.yearInterest, ref.interest, 1e-6);
  close(d.yearPrincipal, ref.principal, 1e-6);
  assert.equal(d.interestDeduction, 200000); // about 4.2 lakh of interest, capped
  close(d.principalDeduction, ref.principal, 1e-6); // about 1 lakh, under the cap
  close(d.totalDeduction, 200000 + ref.principal, 1e-6);
  const small = Home.yearOneDeductions(1000000, 8, 20);
  assert.ok(small.interestDeduction < 200000);
  const big = Home.yearOneDeductions(100000000, 15, 5);
  assert.equal(big.principalDeduction, 150000);
});

test("a tenure under a year counts only the months there are", () => {
  const d = Home.yearOneDeductions(100000, 10, 0.5);
  close(d.yearPrincipal, 100000, 1e-6);
});
