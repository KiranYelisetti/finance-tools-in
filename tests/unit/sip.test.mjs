// Unit tests for src/js/calc/sip.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, close } from "./_helpers.mjs";
import { sipFutureValue } from "../lib/reference.mjs";

const Sip = load("sip");

test("the page's worked example: 5,000 a month at 12% for 10 years is ₹11,61,695", () => {
  const r = Sip.futureValue(5000, 12, 10);
  assert.equal(Math.round(r.futureValue), 1161695);
  assert.equal(r.invested, 600000);
  assert.equal(Math.round(r.returns), 561695);
});

test("1,000 a month at 12% for one year, by hand: 1,010 x (1.01^12 - 1) / 0.01 = 12,809.33", () => {
  close(Sip.futureValue(1000, 12, 1).futureValue, 12809.33, 0.005);
});

test("the page's table: 8%, 10% and 12% over 10, 15 and 20 years", () => {
  const table = { 10: [920828, 1032760, 1161695], 15: [1741726, 2089621, 2522880], 20: [2964736, 3828485, 4995740] };
  for (const [years, values] of Object.entries(table)) {
    [8, 10, 12].forEach((rate, i) => assert.equal(Math.round(Sip.futureValue(5000, rate, Number(years)).futureValue), values[i], `${rate}% over ${years} years`));
  }
});

test("agrees with instalment-by-instalment growth", () => {
  for (const [p, r, t] of [[500, 1, 1], [100000, 30, 40], [7500, 12.5, 7], [2500, 8, 15]]) {
    const fv = Sip.futureValue(p, r, t).futureValue;
    close(fv, sipFutureValue(p, r, t), fv * 1e-12, `${p} at ${r}% for ${t}`);
  }
});

test("0% return: you get back what you put in", () => {
  const r = Sip.futureValue(5000, 0, 10);
  assert.equal(r.futureValue, 600000);
  assert.equal(r.returns, 0);
});

test("zero amount or zero years is zero", () => {
  assert.equal(Sip.futureValue(0, 12, 10).futureValue, 0);
  assert.equal(Sip.futureValue(5000, 12, 0).futureValue, 0);
});

test("very large figures stay finite", () => {
  const r = Sip.futureValue(1e7, 30, 40);
  assert.ok(Number.isFinite(r.futureValue) && r.futureValue > r.invested);
});
