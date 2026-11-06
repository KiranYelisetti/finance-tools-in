// Study Abroad calculator (/study-abroad-calculator/).
// Future cost in rupees = cost today x (1 + fee inflation)^years x rupees per unit today x (1 + rupee fall)^years.
// The rupees-per-unit figures are the page's own stated approximations ("Today $1 = ₹83"), used here as given
// inputs. The monthly saving follows reference.sipNeededForGoal (12% a year, see the note there).
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, setSlider, sliderTo, typeInto } from "./fixtures.mjs";
import { grow, sipNeededForGoal } from "../lib/reference.mjs";

// The page's stated rupee rates, inputs to the sum (not results). See tests/README.md: they look stale.
const PAGE_RATES = { USD: 83, GBP: 105, EUR: 90, AUD: 55, CAD: 62 };
const COUNTRY_DEFAULT_COST = { USD: 200000, GBP: 120000, EUR: 100000, AUD: 180000, CAD: 150000 };

async function expectResults(page, { currency = "USD", cost = 200000, years = 10, inflation = 6, fall = 4 }) {
  const rate = PAGE_RATES[currency];
  const futureForeign = grow(cost, inflation, years);
  const futureRate = grow(rate, fall, years);
  const future = futureForeign * futureRate;
  const today = cost * rate;
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#placeholder")).toBeHidden();
  await expectAmount(page.locator("#totalCostINR"), future, { label: "cost then" });
  await expect(page.locator("#totalCostForeign")).toContainText(currency + " ");
  await expectAmount(page.locator("#totalCostForeign"), futureForeign, { label: "cost then, foreign" });
  await expectAmount(page.locator("#currentCostINR"), today, { label: "cost today" });
  await expect(page.locator("#costIncrease")).toHaveText("+" + ((future / today - 1) * 100).toFixed(1) + "%");
  await expect(page.locator("#resultYears")).toHaveText(String(years));
  await expectAmount(page.locator("#inflationImpact"), futureForeign * rate - today, { label: "fee inflation part" });
  await expectAmount(page.locator("#depreciationImpact"), cost * futureRate - today, { label: "rupee part" });
  const combined = ((1 + inflation / 100) * (1 + fall / 100) - 1) * 100;
  await expect(page.locator("#combinedRate")).toHaveText(combined.toFixed(2) + "% per year");
  await expectAmount(page.locator("#monthlySIP"), sipNeededForGoal(future, 12, years * 12), { label: "monthly saving" });
}

test.describe("Study Abroad calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/study-abroad-calculator/");
  });

  test("opens with a US degree in 10 years", async ({ page }) => {
    await expectResults(page, {});
    await expectNoBadNumbers(page);
  });

  for (const currency of Object.keys(PAGE_RATES)) {
    test(`country ${currency} fills its typical cost`, async ({ page }) => {
      await page.locator("#currency").selectOption(currency);
      // The country list writes the cost without Indian commas (cosmetic only), so compare the number.
      expect(Number((await page.locator("#currentCost").inputValue()).replace(/,/g, ""))).toBe(COUNTRY_DEFAULT_COST[currency]);
      await expectResults(page, { currency, cost: COUNTRY_DEFAULT_COST[currency] });
    });
  }

  for (const [button, preset] of [
    [/America \(USA\)/, { currency: "USD", cost: 200000, years: 10, inflation: 6, fall: 4 }],
    [/UK \(England\)/, { currency: "GBP", cost: 120000, years: 10, inflation: 5.5, fall: 3.5 }],
    [/^🇨🇦\s*Canada|Canada/, { currency: "CAD", cost: 150000, years: 10, inflation: 5, fall: 3 }],
  ]) {
    test(`preset ${preset.currency}`, async ({ page }) => {
      await setField(page.locator("#yearsToStudy"), "3");
      await page.getByRole("button", { name: button }).click();
      await expect(page.locator("#currency")).toHaveValue(preset.currency);
      await expect(page.locator("#inflationValue")).toHaveText(String(preset.inflation));
      await expect(page.locator("#depreciationValue")).toHaveText(String(preset.fall));
      await expectResults(page, preset);
    });
  }

  test("every field and both sliders at their limits", async ({ page }) => {
    await typeInto(page.locator("#currentCost"), "95000");
    await typeInto(page.locator("#yearsToStudy"), "1");
    await sliderTo(page.locator("#inflationRate"), "min");
    await sliderTo(page.locator("#depreciationRate"), "min");
    await expect(page.locator("#inflationValue")).toHaveText("0");
    await expectResults(page, { cost: 95000, years: 1, inflation: 0, fall: 0 });
    await typeInto(page.locator("#yearsToStudy"), "20");
    await sliderTo(page.locator("#inflationRate"), "max");
    await sliderTo(page.locator("#depreciationRate"), "max");
    await expect(page.locator("#inflationValue")).toHaveText("15");
    await expect(page.locator("#depreciationValue")).toHaveText("10");
    await expectResults(page, { cost: 95000, years: 20, inflation: 15, fall: 10 });
    await setSlider(page.locator("#inflationRate"), 7.5);
    await setSlider(page.locator("#depreciationRate"), 2.5);
    await expectResults(page, { cost: 95000, years: 20, inflation: 7.5, fall: 2.5 });
    await page.getByRole("button", { name: "Show Me The Real Amount" }).click();
    await expectResults(page, { cost: 95000, years: 20, inflation: 7.5, fall: 2.5 });
  });

  test("an empty cost or zero years hides the result", async ({ page }) => {
    await setField(page.locator("#currentCost"), "");
    await expect(page.locator("#results")).toBeHidden();
    await expect(page.locator("#placeholder")).toBeVisible();
    await setField(page.locator("#currentCost"), "200000");
    await setField(page.locator("#yearsToStudy"), "0");
    await expect(page.locator("#results")).toBeHidden();
  });

  test("negative years are refused", async ({ page }) => {
    // KNOWN BUG (minor): -5 years is accepted and gives a smaller "future" cost and a negative monthly saving.
    test.fail();
    await setField(page.locator("#yearsToStudy"), "-5");
    await expect(page.locator("#monthlySIP")).not.toContainText("-");
  });

  test("Indian grouping in the cost", async ({ page }) => {
    await expectIndianGrouping(page.locator("#currentCost"));
  });

  test("Reset asks first and restores the defaults", async ({ page, dialogs }) => {
    await page.locator("#currency").selectOption("GBP");
    await setField(page.locator("#yearsToStudy"), "4");
    await page.getByRole("button", { name: "Reset" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/reset/i);
    await expect(page.locator("#currency")).toHaveValue("USD");
    await expect(page.locator("#yearsToStudy")).toHaveValue("10");
    await expect(page.locator("#inflationValue")).toHaveText("6");
    await expectResults(page, {});
  });

  test("choices are saved and come back after a reload", async ({ page }) => {
    await page.locator("#currency").selectOption("AUD");
    await typeInto(page.locator("#currentCost"), "175000");
    await typeInto(page.locator("#yearsToStudy"), "8");
    await setSlider(page.locator("#inflationRate"), 5);
    await page.reload();
    await expect(page.locator("#currency")).toHaveValue("AUD");
    await expect(page.locator("#currentCost")).toHaveValue("1,75,000");
    await expect(page.locator("#yearsToStudy")).toHaveValue("8");
    await expect(page.locator("#inflationValue")).toHaveText("5");
    await expectResults(page, { currency: "AUD", cost: 175000, years: 8, inflation: 5 });
  });

  test("Share sends the amount on WhatsApp", async ({ page }) => {
    const shown = (await page.locator("#totalCostINR").innerText()).trim();
    await expectWhatsAppShare(page, "Share Result", ["Study Abroad Cost", shown]);
  });
});
