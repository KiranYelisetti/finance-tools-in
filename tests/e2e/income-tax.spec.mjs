// Income Tax calculator (/income-tax-calculator/), old regime against new regime, tax year 2026-27.
// Expected tax from reference.incomeTax, written from the Income-tax Act, 2025 and the Finance Act, 2026
// (slabs, s.156 rebate with marginal relief, s.19 standard deduction, 4% cess). The page states that it leaves
// out surcharge, so the main checks follow that. A separate known-gap test shows the surcharge effect.
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, typeInto, inr } from "./fixtures.mjs";
import { incomeTax } from "../lib/reference.mjs";

const FIELDS = { salary: "grossSalary", other: "otherIncome", c80: "deduction80C", d80: "deduction80D", hra: "hraExemption", home: "homeLoanInterest", nps: "nps80CCD", otherDed: "otherDeductions" };
const ZERO = { salary: 0, other: 0, c80: 0, d80: 0, hra: 0, home: 0, nps: 0, otherDed: 0 };

async function fillAll(page, x) {
  for (const [k, id] of Object.entries(FIELDS)) await setField(page.locator("#" + id), String(x[k] ?? 0));
  await page.getByRole("button", { name: "Compare Tax: Old vs New" }).click();
}

/** Old-regime deductions as the law caps them: 80C 1,50,000 (s.123), home loan interest 2,00,000 (s.22(2)),
 *  employee NPS 50,000 (s.124(3)). HRA, 80D and other deductions as entered. */
const oldDeductions = (x) => Math.min(x.c80, 150000) + x.d80 + x.hra + Math.min(x.home, 200000) + Math.min(x.nps, 50000) + x.otherDed;

/** "₹1.23 Lac" style as the page prints amounts, for the verdict sentence. */
const pageMoney = (a) => (a >= 1e7 ? `₹${(a / 1e7).toFixed(2)} Cr` : a >= 1e5 ? `₹${(a / 1e5).toFixed(2)} Lac` : `₹${inr(a)}`);

async function expectResults(page, x) {
  const ded = oldDeductions(x);
  const old = incomeTax({ salary: x.salary, otherIncome: x.other, oldDeductions: ded }, "old", { withSurcharge: true });
  const neu = incomeTax({ salary: x.salary, otherIncome: x.other }, "new", { withSurcharge: true });
  await expect(page.locator("#results")).toBeVisible();
  for (const [p, r] of [["old", old], ["new", neu]]) {
    await expectAmount(page.locator(`#${p}GrossIncome`), r.gross, { label: `${p} gross` });
    await expectAmount(page.locator(`#${p}StdDeduction`), r.std, { label: `${p} standard deduction` });
    await expectAmount(page.locator(`#${p}TaxableIncome`), r.taxable, { label: `${p} taxable` });
    await expectAmount(page.locator(`#${p}TaxBeforeCess`), r.slab, { slack: 0.5, label: `${p} slab tax` });
    await expectAmount(page.locator(`#${p}Rebate`), r.rebate, { slack: 0.5, label: `${p} rebate` });
    if (r.surcharge > 0) await expectAmount(page.locator(`#${p}Surcharge`), r.surcharge, { slack: 0.5, label: `${p} surcharge` });
    else await expect(page.locator(`#${p}SurchargeRow`)).toBeHidden();
    await expectAmount(page.locator(`#${p}Cess`), r.cess, { slack: 0.5, label: `${p} cess` });
    await expectAmount(page.locator(`#${p}TotalTax`), r.total, { slack: 0.5, label: `${p} total tax` });
    await expectAmount(page.locator(`#${p}MonthlyTax`), r.total / 12, { slack: 0.6, label: `${p} monthly tax` });
    const rate = r.gross > 0 ? ((Math.round(r.total) / r.gross) * 100).toFixed(1) + "%" : "0%";
    await expect(page.locator(`#${p}EffectiveRate`)).toHaveText(rate);
  }
  await expectAmount(page.locator("#oldChapterDeductions"), ded, { label: "old deductions" });
  const o = Math.round(old.total);
  const n = Math.round(neu.total);
  const verdict = page.locator("#verdictText");
  if (n < o) await expect(verdict).toHaveText(`✅ New Regime saves you ${pageMoney(o - n)}/year!`);
  else if (o < n) await expect(verdict).toHaveText(`✅ Old Regime saves you ${pageMoney(n - o)}/year!`);
  else await expect(verdict).toHaveText("⚖️ Both regimes result in the same tax!");
  await expect(page.locator("#verdictSavings")).toHaveText(
    `Old Regime: ${pageMoney(o)}/year (${pageMoney(Math.round(o / 12))}/month) | New Regime: ${pageMoney(n)}/year (${pageMoney(Math.round(n / 12))}/month)`,
  );
  return { old, neu };
}

test.describe("Income Tax calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/income-tax-calculator/");
  });

  test("opens with a 12 lakh salary compared", async ({ page }) => {
    await expect(page.locator("#grossSalary")).toHaveValue("12,00,000");
    await expectResults(page, { ...ZERO, salary: 1200000, c80: 150000, d80: 25000 });
    await expectNoBadNumbers(page);
  });

  // The page's own worked comparisons (section "Worked comparisons at three salary levels")
  const worked = [
    ["fresher, 8 lakh", { ...ZERO, salary: 800000, c80: 150000, d80: 25000 }, 28600, 0],
    ["mid-career, 15 lakh", { ...ZERO, salary: 1500000, c80: 150000, d80: 50000, hra: 200000 }, 132600, 97500],
    ["senior, 30 lakh, every deduction", { ...ZERO, salary: 3000000, c80: 150000, d80: 75000, hra: 400000, home: 200000, nps: 50000 }, 452400, 475800],
  ];
  for (const [label, x, oldTax, newTax] of worked) {
    test(`worked comparison: ${label}`, async ({ page }) => {
      await fillAll(page, x);
      const { old, neu } = await expectResults(page, x);
      expect(Math.round(old.total)).toBe(oldTax);
      expect(Math.round(neu.total)).toBe(newTax);
      // and the article quotes the same figures
      await expect(page.getByText(`Old regime tax: ₹${inr(oldTax)}`)).toBeVisible();
    });
  }

  const cases = [
    ["new regime: 12.75 lakh salary pays nothing (rebate up to 12 lakh taxable)", { ...ZERO, salary: 1275000 }],
    ["new regime: marginal relief at 12.1 lakh taxable (the page's example, ₹10,400)", { ...ZERO, salary: 1285000 }],
    ["new regime: relief ends near 12,70,588 taxable", { ...ZERO, salary: 1345588 }],
    ["new regime: past the relief band", { ...ZERO, salary: 1355000 }],
    ["old regime: taxable exactly 5 lakh is tax free", { ...ZERO, salary: 550000 }],
    ["old regime: just over 5 lakh, no marginal relief", { ...ZERO, salary: 550010 }],
    ["each slab edge: 24 lakh taxable in the new regime", { ...ZERO, salary: 2475000 }],
    ["other income only, no salary so no standard deduction", { ...ZERO, other: 1000000 }],
    ["salary below the standard deduction", { ...ZERO, salary: 40000 }],
    ["salary and other income together", { ...ZERO, salary: 900000, other: 450000, c80: 100000, d80: 30000, otherDed: 20000 }],
    ["above 50 lakh, with 10% surcharge", { ...ZERO, salary: 6000000, c80: 150000 }],
    ["2 crore salary, with 15% surcharge", { ...ZERO, salary: 20000000 }],
  ];
  for (const [label, x] of cases) {
    test(label, async ({ page }) => {
      await fillAll(page, x);
      await expectResults(page, x);
    });
  }

  test("the page's marginal relief example: taxable 12,10,000 pays ₹10,400", async ({ page }) => {
    await fillAll(page, { ...ZERO, salary: 1285000 });
    await expect(page.locator("#newTotalTax")).toHaveText("₹10,400");
    await expect(page.locator("#newRebate")).toHaveText("- ₹51,500");
  });

  test("80C, home loan interest and NPS are capped at their limits", async ({ page }) => {
    const x = { ...ZERO, salary: 2000000, c80: 300000, home: 350000, nps: 90000 };
    await fillAll(page, x);
    await expectAmount(page.locator("#oldChapterDeductions"), 150000 + 200000 + 50000);
    await expectResults(page, x);
  });

  test("80D is capped at the legal maximum of 1,00,000", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: the 80D field is not capped in the maths (only the input's max attribute says 1,00,000, which
    // typing ignores). The most s.126 allows is 50,000 for a senior-citizen family plus 50,000 for senior parents.
    await fillAll(page, { ...ZERO, salary: 2000000, d80: 250000 });
    await expectAmount(page.locator("#oldChapterDeductions"), 100000);
  });

  test("empty fields give zero tax and never NaN", async ({ page }) => {
    await fillAll(page, ZERO);
    await expectNoBadNumbers(page);
    await expect(page.locator("#oldTotalTax")).toHaveText("₹0");
    await expect(page.locator("#newTotalTax")).toHaveText("₹0");
    await expect(page.locator("#verdictText")).toHaveText("⚖️ Both regimes result in the same tax!");
    await expect(page.locator("#oldEffectiveRate")).toHaveText("0%");
  });

  test("Indian grouping in all eight rupee fields", async ({ page }) => {
    for (const id of Object.values(FIELDS)) await expectIndianGrouping(page.locator("#" + id));
  });

  test("Compare scrolls to the results", async ({ page }) => {
    await page.getByRole("button", { name: "Compare Tax: Old vs New" }).click();
    await expect(page.locator("#results")).toBeInViewport();
  });

  test("Reset asks first and restores the defaults", async ({ page, dialogs }) => {
    await fillAll(page, { ...ZERO, salary: 3300000, hra: 120000 });
    await page.getByRole("button", { name: "Reset" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/reset/i);
    await expect(page.locator("#grossSalary")).toHaveValue("12,00,000");
    await expect(page.locator("#deduction80C")).toHaveValue("1,50,000");
    await expect(page.locator("#deduction80D")).toHaveValue("25,000");
    await expect(page.locator("#hraExemption")).toHaveValue("0");
    await page.getByRole("button", { name: "Compare Tax: Old vs New" }).click();
    await expectResults(page, { ...ZERO, salary: 1200000, c80: 150000, d80: 25000 });
  });

  test("a typed salary is saved and comes back after a reload", async ({ page }) => {
    // FIXED 2026-11-06 in main.js, kept as a regression test. Was a known bug: auto-save loses Indian-formatted amounts (see home-loan.spec.mjs). Every field on this page is
    // an Indian-format field, so nothing typed here survives a reload.
    await typeInto(page.locator("#grossSalary"), "1800000");
    await page.locator("#otherIncome").click();
    await page.reload();
    await expect(page.locator("#grossSalary")).toHaveValue("18,00,000");
  });

  test("true tax above 50 lakh includes surcharge", async ({ page }) => {
    // DISCLOSED LIMITATION, kept as a known failure so it flips when surcharge is added. The page says it leaves
    // surcharge out, but its "Total Tax" line is then short for anyone above 50 lakh. At a 60 lakh salary (new
    // regime, taxable 59.25 lakh) the slab tax is 13,57,500, surcharge 10% is 1,35,750 (Finance Act, 2026,
    // s.3(4)(b)), and with 4% cess the tax is 15,52,980, against the ₹14.12 lakh shown.
    await fillAll(page, { ...ZERO, salary: 6000000 });
    const withSurcharge = incomeTax({ salary: 6000000 }, "new", { withSurcharge: true });
    await expectAmount(page.locator("#newTotalTax"), withSurcharge.total);
  });

  test("Share sends the verdict on WhatsApp", async ({ page }) => {
    const verdict = (await page.locator("#verdictText").innerText()).trim();
    await expectWhatsAppShare(page, /share/i, ["Income Tax", verdict]);
  });
});
