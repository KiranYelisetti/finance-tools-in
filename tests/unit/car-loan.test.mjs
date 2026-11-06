// Unit tests for src/js/calc/car-loan.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, close, knownBug } from "./_helpers.mjs";
import { emi } from "../lib/reference.mjs";

const Car = load("car-loan");
const DEFAULTS = { carPrice: 1000000, downPayment: 200000, annualRate: 9.5, tenureYears: 5, insurance: 25000, rtoTaxPercent: 10, accessories: 0, otherCharges: 15000 };

test("the page's default new car, worked by hand", () => {
  const r = Car.calculate(DEFAULTS);
  // Road tax 10% of 10,00,000 = 1,00,000. On-road = 10,00,000 + 1,00,000 + 25,000 + 0 + 15,000 = 11,40,000.
  assert.equal(r.rtoAmount, 100000);
  assert.equal(r.onRoadPrice, 1140000);
  assert.equal(r.loanAmount, 940000);
  assert.equal(r.tenureMonths, 60);
  // r = 9.5/1200, (1 + r)^60 = 1.605009, EMI = 9,40,000 x r x 1.605009 / 0.605009 = 19,741.75
  close(r.emi, 19741.75, 0.01);
  close(r.totalEMIPayments, r.emi * 60);
  close(r.totalInterest, r.emi * 60 - 940000);
  close(r.totalAmountPaid, 200000 + r.emi * 60);
  close(r.interestPercentOfPrice, (r.totalInterest / 1000000) * 100);
  close(r.downPaymentPercent, (200000 / 1140000) * 100);
});

test("EMI agrees with the present-value formula across rates and tenures", () => {
  for (const annualRate of [5, 7.6, 9.5, 13, 20]) {
    for (const tenureYears of [1, 3, 5, 7]) {
      const r = Car.calculate({ ...DEFAULTS, annualRate, tenureYears });
      close(r.emi, emi(r.loanAmount, annualRate, tenureYears * 12), 1e-6, `${annualRate}% over ${tenureYears} years`);
    }
  }
});

test("1,00,000 at 12% for one year: EMI 8,884.88 (1.01^12 = 1.126825)", () => {
  const r = Car.calculate({ carPrice: 100000, downPayment: 0, annualRate: 12, tenureYears: 1 });
  close(r.emi, 8884.88, 0.005);
});

test("optional costs default to zero when missing", () => {
  const r = Car.calculate({ carPrice: 500000, downPayment: 100000, annualRate: 10, tenureYears: 3 });
  assert.equal(r.onRoadPrice, 500000);
  assert.equal(r.loanAmount, 400000);
});

test("a very large loan stays finite", () => {
  const r = Car.calculate({ ...DEFAULTS, carPrice: 5e8 });
  assert.ok(Number.isFinite(r.emi) && r.emi > 0);
});

test("a down payment equal to the on-road price leaves nothing to borrow", () => {
  const r = Car.calculate({ ...DEFAULTS, downPayment: 1140000 });
  assert.equal(r.loanAmount, 0);
  assert.equal(r.emi, 0);
});

knownBug("0% interest gives EMI = loan / months", "0/0 gives NaN, the page shows ₹NaN", () => {
  const r = Car.calculate({ ...DEFAULTS, annualRate: 0 });
  close(r.emi, 940000 / 60);
});

knownBug("a down payment above the on-road price does not give a negative loan", "no check, loan and EMI go negative", () => {
  const r = Car.calculate({ ...DEFAULTS, downPayment: 2000000 });
  assert.ok(r.loanAmount >= 0 && r.emi >= 0);
});
