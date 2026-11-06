// Unit tests for src/js/calc/gst.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, close } from "./_helpers.mjs";
import { gst } from "../lib/reference.mjs";

const Gst = load("gst");

test("add 18% to 1,000: GST 180, total 1,180, CGST and SGST 90 each", () => {
  const r = Gst.calculate(1000, 18, "add");
  assert.deepEqual(r, { originalAmount: 1000, gstAmount: 180, finalAmount: 1180, cgst: 90, sgst: 90, igst: 180 });
});

test("remove 18% from 1,180: 1,000 before GST, 180 GST", () => {
  const r = Gst.calculate(1180, 18, "remove");
  close(r.originalAmount, 1000, 1e-9);
  close(r.gstAmount, 180, 1e-9);
  assert.equal(r.finalAmount, 1180);
});

test("every rate on the page, both ways, agrees with the tax fraction", () => {
  for (const rate of [0, 0.25, 3, 5, 12, 18, 28, 40, 7.5, 100]) {
    for (const amount of [0.99, 1, 23450, 99999.99, 12345678.9]) {
      for (const mode of ["add", "remove"]) {
        const r = Gst.calculate(amount, rate, mode);
        const ref = gst(amount, rate, mode);
        close(r.originalAmount, ref.base, 1e-6, `${mode} ${rate}% of ${amount}`);
        close(r.gstAmount, ref.tax, 1e-6);
        close(r.finalAmount, ref.total, 1e-6);
        close(r.cgst + r.sgst, r.igst, 1e-9);
      }
    }
  }
});

test("zero, negative or missing amount gives no result", () => {
  for (const amount of [0, -5, NaN, undefined]) assert.equal(Gst.calculate(amount, 18, "add"), null);
});

test("custom rate is clamped to 0 to 100", () => {
  assert.equal(Gst.clampCustomRate("7.5"), 7.5);
  assert.equal(Gst.clampCustomRate("150"), 100);
  assert.equal(Gst.clampCustomRate("-5"), 0);
  assert.equal(Gst.clampCustomRate(""), 0);
  assert.equal(Gst.clampCustomRate("abc"), 0);
  assert.equal(Gst.clampCustomRate("100"), 100);
  assert.equal(Gst.clampCustomRate("0"), 0);
});
