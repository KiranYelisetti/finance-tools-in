// SIP calculator (/sip-calculator/).
// The page states its convention: the annual rate is split into twelve monthly rates (12% a year = 1% a month) and
// each instalment is invested at the start of its month. reference.sipFutureValue sums each instalment's growth.
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, setSlider, sliderTo, typeInto, inr } from "./fixtures.mjs";
import { sipFutureValue } from "../lib/reference.mjs";

async function expectResults(page, monthly, rate, years) {
  const fv = sipFutureValue(monthly, rate, years);
  const invested = monthly * years * 12;
  await expectAmount(page.locator("#totalValue"), fv, { label: "total value" });
  await expectAmount(page.locator("#investedAmount"), invested, { label: "invested" });
  await expectAmount(page.locator("#estReturns"), fv - invested, { label: "returns" });
  // The doughnut chart is drawn with the same two figures
  const data = await page.evaluate(() => window.Chart.getChart("sipChart").data.datasets[0].data);
  expect(Math.abs(data[0] - invested)).toBeLessThan(0.01);
  expect(Math.abs(data[1] - (fv - invested))).toBeLessThan(0.01);
}

// The three sliders have no labels, so they are found by order: amount, rate, years.
const slider = (page, i) => page.getByRole("slider").nth(i);

test.describe("SIP calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sip-calculator/");
  });

  test("opens with 5,000 a month at 12% for 10 years", async ({ page }) => {
    await expect(page.locator("#monthlyInvestment")).toHaveValue("5,000");
    await expectResults(page, 5000, 12, 10);
    await expectNoBadNumbers(page);
  });

  const plans = [[2500, 8, 15], [10000, 10, 20], [25000, 15, 5], [500, 1, 1], [100000, 30, 40], [7500, 12.5, 7]];
  for (const [monthly, rate, years] of plans) {
    test(`${inr(monthly)} a month at ${rate}% for ${years} years`, async ({ page }) => {
      await typeInto(page.locator("#monthlyInvestment"), String(monthly));
      await typeInto(page.locator("#returnRate"), String(rate));
      await typeInto(page.locator("#timePeriod"), String(years));
      await expectResults(page, monthly, rate, years);
    });
  }

  test("0% return gives back exactly what was invested", async ({ page }) => {
    await setField(page.locator("#returnRate"), "0");
    await expectResults(page, 5000, 0, 10);
  });

  test("an empty amount shows zero, never NaN", async ({ page }) => {
    await setField(page.locator("#monthlyInvestment"), "");
    await expectNoBadNumbers(page);
    await expectAmount(page.locator("#totalValue"), 0);
  });

  test("sliders at their minimum and maximum drive the fields", async ({ page }) => {
    await sliderTo(slider(page, 0), "max");
    await expect(page.locator("#monthlyInvestment")).toHaveValue("1,00,000");
    await sliderTo(slider(page, 1), "max");
    await expect(page.locator("#returnRate")).toHaveValue("30");
    await sliderTo(slider(page, 2), "max");
    await expect(page.locator("#timePeriod")).toHaveValue("40");
    await expectResults(page, 100000, 30, 40);

    await sliderTo(slider(page, 0), "min");
    await expect(page.locator("#monthlyInvestment")).toHaveValue("500");
    await sliderTo(slider(page, 1), "min");
    await expect(page.locator("#returnRate")).toHaveValue("1");
    await sliderTo(slider(page, 2), "min");
    await expect(page.locator("#timePeriod")).toHaveValue("1");
    await expectResults(page, 500, 1, 1);

    await setSlider(slider(page, 0), 12500);
    await setSlider(slider(page, 1), 11.5);
    await setSlider(slider(page, 2), 18);
    await expect(page.locator("#monthlyInvestment")).toHaveValue("12,500");
    await expectResults(page, 12500, 11.5, 18);
  });

  test("typing a value moves the matching slider", async ({ page }) => {
    // KNOWN BUG (minor): the sliders only push values into the fields. Typing 20,000 leaves the amount slider at
    // 5,000, so slider and field disagree. The PPF and SSY pages keep both in step.
    test.fail();
    await typeInto(page.locator("#monthlyInvestment"), "20000");
    await expect(slider(page, 0)).toHaveValue("20000");
  });

  test("Indian grouping in the monthly amount", async ({ page }) => {
    await expectIndianGrouping(page.locator("#monthlyInvestment"));
  });

  test("the reset button asks first and restores the defaults", async ({ page, dialogs }) => {
    await typeInto(page.locator("#returnRate"), "9");
    await typeInto(page.locator("#timePeriod"), "25");
    // The reset button shows only an icon and has no accessible name, so it is found by its action.
    await page.locator('button[onclick^="resetForm"]').click();
    expect(dialogs.messages.at(-1)).toMatch(/reset/i);
    await expect(page.locator("#returnRate")).toHaveValue("12");
    await expect(page.locator("#timePeriod")).toHaveValue("10");
    await expectResults(page, 5000, 12, 10);
  });

  test("rate and years are saved and come back after a reload", async ({ page }) => {
    await typeInto(page.locator("#returnRate"), "14");
    await typeInto(page.locator("#timePeriod"), "12");
    await page.reload();
    await expect(page.locator("#returnRate")).toHaveValue("14");
    await expect(page.locator("#timePeriod")).toHaveValue("12");
    await expectResults(page, 5000, 14, 12);
  });

  test("a typed monthly amount is saved and comes back after a reload", async ({ page }) => {
    // FIXED 2026-11-06 in main.js, kept as a regression test. Was a known bug: auto-save loses Indian-formatted amounts (see home-loan.spec.mjs for the cause).
    await typeInto(page.locator("#monthlyInvestment"), "15000");
    await page.locator("#returnRate").click();
    await page.reload();
    await expect(page.locator("#monthlyInvestment")).toHaveValue("15,000");
  });

  test("a value set with a slider is saved and comes back after a reload", async ({ page }) => {
    // KNOWN BUG: the slider writes into the rate field without firing an input event, and the slider itself has
    // no id, so auto-save never stores a slider move. After a reload the rate is back to 12%.
    test.fail();
    await sliderTo(slider(page, 1), "max");
    await expect(page.locator("#returnRate")).toHaveValue("30");
    await page.reload();
    await expect(page.locator("#returnRate")).toHaveValue("30");
  });

  test("Share sends the total on WhatsApp", async ({ page }) => {
    const shown = (await page.locator("#totalValue").innerText()).trim();
    await expectWhatsAppShare(page, "Share Result", ["SIP Returns", shown]);
  });

  test("the worked example and the table agree with the formula", async ({ page }) => {
    await expect(page.getByText("The formula produces")).toContainText(`₹${inr(sipFutureValue(5000, 12, 10))}`);
    const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "At 12%" }) });
    const rates = (await table.getByRole("columnheader").allTextContents()).map((h) => h.match(/At ([\d.]+)%/)).filter(Boolean).map((m) => Number(m[1]));
    const rows = await table.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent.trim())));
    expect(rows.length).toBe(3);
    for (const [yearsCell, investedCell, ...values] of rows) {
      const years = parseInt(yearsCell, 10);
      expect(investedCell).toBe(`₹${inr(5000 * 12 * years)}`);
      values.forEach((v, i) => expect(v, `${years} years at ${rates[i]}%`).toBe(`₹${inr(sipFutureValue(5000, rates[i], years))}`));
    }
  });
});
