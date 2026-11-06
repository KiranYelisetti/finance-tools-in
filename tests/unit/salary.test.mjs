// Unit tests for src/js/calc/salary.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, close, knownBug } from "./_helpers.mjs";
import { salary, incomeTax } from "../lib/reference.mjs";

const Sal = load("salary");
const base = { annualCTC: 1000000, cityType: "metro", basicPercent: 40, monthlyBonus: 0, profTax: 200 };

test("the page's worked example: 10 lakh CTC, metro, 40% basic, in-hand ₹73,530", () => {
  const s = Sal.calculate(base);
  close(s.monthlyBasic, 33333.33, 0.005);
  close(s.monthlyHRA, 16666.67, 0.005);
  close(s.monthlyEmployerPF, 4000, 1e-9);
  close(s.monthlyGratuity, 1603.33, 0.005);
  close(s.monthlySpecialAllowance, 27730, 1e-6);
  close(s.monthlyGross, 77730, 1e-6);
  assert.equal(s.annualTax, 0); // 9,32,760 - 75,000 = 8,57,760 taxable, under the 12 lakh rebate limit
  close(s.monthlyInHand, 73530, 1e-6);
  assert.equal(s.monthlyEmployerESI, 0);
});

test("non-metro moves money from HRA to special allowance, in-hand is unchanged", () => {
  const metro = Sal.calculate(base);
  const other = Sal.calculate({ ...base, cityType: "nonmetro" });
  assert.equal(other.hraPercent, 40);
  close(other.monthlyHRA, metro.monthlyBasic * 0.4, 1e-9);
  close(other.monthlyGross, metro.monthlyGross, 1e-9);
  close(other.monthlyInHand, metro.monthlyInHand, 1e-9);
});

test("agrees with the reference across CTCs, basic %, bonus and professional tax", () => {
  for (const annualCTC of [100000, 240000, 252000, 1000000, 1600000, 2500000, 5000000]) {
    for (const [basicPercent, cityType, monthlyBonus, profTax] of [[40, "metro", 0, 200], [50, "nonmetro", 10000, 250], [20, "metro", 0, 300]]) {
      const s = Sal.calculate({ annualCTC, cityType, basicPercent, monthlyBonus, profTax });
      const r = salary({ ctc: annualCTC, basicPct: basicPercent, hraPct: cityType === "metro" ? 50 : 40, monthlyBonus, profTax, employeeEsi: true });
      const tag = `${annualCTC} ${basicPercent}% ${cityType}`;
      close(s.monthlyGross, r.gross, 1e-6, tag);
      close(s.annualTax, r.annualTax, 0.5, tag);
      close(s.monthlyInHand, r.inHand, 1, tag);
      close(s.monthlyEmployerESI, r.employerEsi, 1e-9, tag);
    }
  }
});

test("new-regime tax on salary matches the income tax rules", () => {
  for (const gross of [0, 500000, 1275000, 1285000, 1355000, 2475000, 6000000]) {
    assert.equal(Sal.newRegimeTax(gross), Math.round(incomeTax({ salary: gross }, "new", { withSurcharge: true }).total), String(gross));
  }
});

test("employer ESI only up to 21,000 a month of CTC", () => {
  close(Sal.calculate({ ...base, annualCTC: 252000 }).monthlyEmployerESI, 21000 * 0.0325, 1e-9);
  assert.equal(Sal.calculate({ ...base, annualCTC: 252012 }).monthlyEmployerESI, 0);
});

test("zero professional tax is zero here (the page's || 200 is the bug, see the e2e test)", () => {
  assert.equal(Sal.calculate({ ...base, profTax: 0 }).profTax, 0);
});

test("zero CTC gives zero pay, never NaN", () => {
  const s = Sal.calculate({ ...base, annualCTC: 0, profTax: 0 });
  assert.equal(s.monthlyGross, 0);
  assert.equal(s.monthlyInHand, 0);
});

// Fixed 2026-11-06 (was a known bug: employee ESI was never deducted)
test("an ESI-covered salary deducts the employee's 0.75%", () => {
  const s = Sal.calculate({ ...base, annualCTC: 240000, cityType: "nonmetro" });
  const r = salary({ ctc: 240000, hraPct: 40, employeeEsi: true });
  close(s.monthlyInHand, r.inHand, 1);
});

// Fixed 2026-11-06 (was a known bug: at 60% basic in a 50% city the parts exceeded the CTC by 0.09%)
test("the parts never add up to more than the CTC", () => {
  const s = Sal.calculate({ ...base, basicPercent: 60 });
  assert.ok(s.monthlyGross + s.monthlyEmployerPF + s.monthlyGratuity + s.monthlyEmployerESI <= 1000000 / 12 + 1e-6);
});
