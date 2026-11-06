// Unit tests for the cash counter, study abroad, wedding cost and image resizer modules in src/js/calc
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, close, knownBug } from "./_helpers.mjs";
import { DENOMINATIONS, grow, sipNeededForGoal } from "../lib/reference.mjs";

const Cash = load("cash-counter");
const Study = load("study-abroad");
const Wedding = load("wedding-cost");
const Img = load("image-resizer");

// ── Cash counter ──

test("cash: the boxes and their face values", () => {
  assert.deepEqual(Cash.DENOMINATIONS, DENOMINATIONS);
});

test("cash: 3 x 500 + 2 x 10 + 7 x 1 = 1,527", () => {
  assert.equal(Cash.total({ note500: 3, note10: 2, coin1: 7 }), 1527);
  assert.equal(Cash.total({}), 0);
});

test("cash: every box at 99,999 is 99,999 x 2,918 = 29,17,97,082", () => {
  const all = Object.fromEntries(Object.keys(DENOMINATIONS).map((k) => [k, 99999]));
  assert.equal(Cash.total(all), 99999 * 2918);
});

test("cash: counts are whole numbers from 0 to 99,999", () => {
  assert.deepEqual(Cash.clampCount("37"), { count: 37, changed: false });
  assert.deepEqual(Cash.clampCount(""), { count: 0, changed: false });
  assert.deepEqual(Cash.clampCount("abc"), { count: 0, changed: false });
  assert.deepEqual(Cash.clampCount("2.9"), { count: 2, changed: false });
  assert.deepEqual(Cash.clampCount("150000"), { count: 99999, changed: true });
  assert.deepEqual(Cash.clampCount("-5"), { count: 0, changed: true });
});

test("cash: the words line as it is today", () => {
  assert.equal(Cash.numberToWords(0), "");
  assert.equal(Cash.numberToWords(15750), "15 Thousand 7 Hundred 50 Rupees");
  assert.equal(Cash.numberToWords(291797082), "29 Crore 17 Lakh 97 Thousand 82 Rupees");
});

knownBug("cash: the words line is written in words", "prints digits with unit names", () => {
  assert.match(Cash.numberToWords(15750), /^Fifteen Thousand Seven Hundred Fifty Rupees/);
});

// ── Study abroad ──

// Rupee rates are SBI forex card TT selling rates, 6 Nov 2026 2:09 pm IST (the page states the date).
// When the page's rates are refreshed, update this table and the worked figure below from the same source.
const RATES = { USD: 94.45, GBP: 127.41, EUR: 106.50, AUD: 65.77, CAD: 67.63 };

test("study abroad: US degree, 2,00,000 dollars, 10 years, 6% fees, rupee falls 4% a year", () => {
  // 2,00,000 x 1.06^10 (1.790848) x 94.45 x 1.04^10 (1.480244) = ₹50,075,351.16
  const r = Study.calculate({ currency: "USD", currentCost: 200000, years: 10, inflationPct: 6, depreciationPct: 4 });
  close(r.futureCostINR, 50075351.16, 0.01);
  close(r.currentCostINR, 200000 * RATES.USD, 1e-6);
  close(r.futureCostForeign, grow(200000, 6, 10), 1e-6);
  close(r.inflationImpact, grow(200000, 6, 10) * RATES.USD - 200000 * RATES.USD, 1e-6);
  close(r.depreciationImpact, 200000 * grow(RATES.USD, 4, 10) - 200000 * RATES.USD, 1e-6);
  close(r.combinedRatePercent, (1.06 * 1.04 - 1) * 100, 1e-9);
  close(r.monthlySaving, sipNeededForGoal(r.futureCostINR, 12, 120), 1e-6);
});

test("study abroad: every currency uses its stated rupee rate", () => {
  for (const [currency, rate] of Object.entries(RATES)) {
    const r = Study.calculate({ currency, currentCost: 1000, years: 1, inflationPct: 0, depreciationPct: 0 });
    close(r.currentCostINR, 1000 * rate, 1e-6);
    close(r.futureCostINR, 1000 * rate, 1e-9);
  }
});

test("study abroad: missing cost or years gives no result", () => {
  assert.equal(Study.calculate({ currency: "USD", currentCost: 0, years: 10, inflationPct: 6, depreciationPct: 4 }), null);
  assert.equal(Study.calculate({ currency: "USD", currentCost: 1000, years: 0, inflationPct: 6, depreciationPct: 4 }), null);
  assert.equal(Study.calculate({ currency: "USD", currentCost: 1000, years: NaN, inflationPct: 6, depreciationPct: 4 }), null);
});

test("monthly saving for a goal: 10 lakh in 10 years at 12% a year is ₹4,505.92", () => {
  close(Study.monthlySavingFor(1000000, 120), 4505.92, 0.005);
  close(Wedding.monthlySavingFor(1000000, 120), 4505.92, 0.005);
});

knownBug("study abroad: negative years are refused", "-5 years gives a negative monthly saving", () => {
  const r = Study.calculate({ currency: "USD", currentCost: 200000, years: -5, inflationPct: 6, depreciationPct: 4 });
  assert.ok(r === null || r.monthlySaving >= 0);
});

// ── Wedding cost ──

test("wedding: 20 lakh in 5 years at 8% is ₹29,38,656.15 (1.08^5 = 1.469328)", () => {
  const r = Wedding.calculate({ baseBudget: 2000000, years: 5, inflationPct: 8 });
  close(r.totalFutureCost, 2938656.15, 0.005);
  assert.equal(r.currentTotalCost, 2000000);
  close(r.increasePercent, (1.08 ** 5 - 1) * 100, 1e-9);
});

test("wedding: destination adds 20%, gold grows 10% a year", () => {
  const r = Wedding.calculate({ baseBudget: 5000000, years: 7, inflationPct: 9, isDestination: true, hasGold: true, goldAmount: 1000000 });
  const wedding = grow(5000000, 9, 7);
  close(r.destinationPremium, wedding * 0.2, 1e-6);
  close(r.futureGoldCost, grow(1000000, 10, 7), 1e-6);
  close(r.totalFutureCost, wedding * 1.2 + grow(1000000, 10, 7), 1e-6);
  assert.equal(r.currentTotalCost, 5000000 * 1.2 + 1000000);
  close(r.monthlySaving, sipNeededForGoal(r.totalFutureCost, 12, 84), 1e-6);
});

test("wedding: gold amount is ignored when gold is off", () => {
  const r = Wedding.calculate({ baseBudget: 2000000, years: 5, inflationPct: 8, hasGold: false, goldAmount: 900000 });
  assert.equal(r.futureGoldCost, 0);
  assert.equal(r.currentTotalCost, 2000000);
});

test("wedding: missing budget or years gives no result", () => {
  assert.equal(Wedding.calculate({ baseBudget: 0, years: 5, inflationPct: 8 }), null);
  assert.equal(Wedding.calculate({ baseBudget: 2000000, years: 0, inflationPct: 8 }), null);
});

knownBug("wedding: the breakdown lines add up to the total", "'wedding expenses' already includes the destination premium", () => {
  const r = Wedding.calculate({ baseBudget: 2000000, years: 5, inflationPct: 8, isDestination: true });
  close(r.futureWeddingCost + r.destinationPremium + r.futureGoldCost, r.totalFutureCost, 0.5);
});

// ── Image resizer ──

const photo = { width: 200, height: 100 };

test("image: percentage scaling, rounded to whole pixels", () => {
  assert.deepEqual(Img.targetSize("percentage", photo, "100"), { width: 200, height: 100 });
  assert.deepEqual(Img.targetSize("percentage", photo, "10"), { width: 20, height: 10 });
  assert.deepEqual(Img.targetSize("percentage", photo, "200"), { width: 400, height: 200 });
  assert.deepEqual(Img.targetSize("percentage", photo, "37"), { width: 74, height: 37 });
  assert.deepEqual(Img.targetSize("percentage", { width: 333, height: 111 }, "50"), { width: 167, height: 56 });
});

test("image: typed dimensions, falling back to the original when missing or zero", () => {
  assert.deepEqual(Img.targetSize("dimensions", photo, "100", "300", "33"), { width: 300, height: 33 });
  assert.deepEqual(Img.targetSize("preset", photo, "100", "512", "512"), { width: 512, height: 512 });
  assert.deepEqual(Img.targetSize("dimensions", photo, "100", "", "0"), { width: 200, height: 100 });
});

test("image: keeping the aspect ratio", () => {
  assert.equal(Img.linkedSide("width", "150", photo), 75);
  assert.equal(Img.linkedSide("height", "33", photo), 66);
  assert.equal(Img.linkedSide("width", "", photo), null);
  assert.equal(Img.linkedSide("width", "-4", photo), null);
  assert.equal(Img.linkedSide("height", "0", photo), null);
});

test("image: presets, extensions and size labels", () => {
  assert.deepEqual(Img.parsePreset("1920,1080"), { width: 1920, height: 1080 });
  assert.equal(Img.parsePreset(""), null);
  assert.equal(Img.extensionFor("image/png"), "png");
  assert.equal(Img.extensionFor("image/jpeg"), "jpg");
  assert.equal(Img.extensionFor("image/webp"), "webp");
  assert.equal(Img.fileSizeLabel(1536), "1.50 KB");
  assert.equal(Img.fileSizeLabel(1048576), "1024.00 KB"); // exactly 1 MB still shows in KB
  assert.equal(Img.fileSizeLabel(1572864), "1.50 MB");
});
