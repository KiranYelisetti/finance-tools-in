// PPF calculator (/ppf-calculator/).
// Balance year by year from reference.ppfBalances: each year's deposit earns the full year's interest, compounded
// yearly. That is the best case under the PPF Scheme, 2019 (deposit by 5 April). The page does not say it assumes
// this, see tests/README.md.
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, setSlider, sliderTo, typeInto, inr } from "./fixtures.mjs";
import { ppfBalances, ppfWithdrawalLimit } from "../lib/reference.mjs";

async function expectResults(page, deposit, years, rate) {
  const b = ppfBalances(deposit, rate, years);
  const maturity = b[years];
  const invested = deposit * years;
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#placeholder")).toBeHidden();
  await expectAmount(page.locator("#maturityValue"), maturity, { label: "maturity" });
  await expectAmount(page.locator("#totalContribution"), invested, { label: "contributions" });
  await expectAmount(page.locator("#totalInterest"), maturity - invested, { label: "interest" });
  // Old-regime deduction: the whole deposit, within the 1,50,000 limit (Income-tax Act 2025 s.123, old 80C)
  await expectAmount(page.locator("#taxBenefit"), Math.min(deposit, 150000), { label: "deduction" });
  await expect(page.locator("#breakdown")).toContainText(`for ${years} years`);
  await expect(page.locator("#breakdown")).toContainText(`${rate.toFixed(1)}%`);
  return b;
}

test.describe("PPF calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ppf-calculator/");
  });

  test("opens with 1 lakh a year for 15 years at 7.1%", async ({ page }) => {
    await expect(page.locator("#annualContribution")).toHaveValue("1,00,000");
    await expectResults(page, 100000, 15, 7.1);
    await expectNoBadNumbers(page);
  });

  const plans = [[500, 15, 7.1], [150000, 15, 7.1], [60000, 20, 7.1], [150000, 30, 8], [25000, 25, 6.5], [123456, 17, 7.6]];
  for (const [deposit, years, rate] of plans) {
    test(`${inr(deposit)} a year for ${years} years at ${rate}%`, async ({ page }) => {
      await typeInto(page.locator("#annualContribution"), String(deposit));
      await typeInto(page.locator("#investmentPeriod"), String(years));
      await typeInto(page.locator("#interestRate"), String(rate));
      await expectResults(page, deposit, years, rate);
    });
  }

  for (const [name, deposit] of [["Conservative", 50000], ["Moderate", 100000], ["Maximum", 150000]]) {
    test(`preset ${name}`, async ({ page }) => {
      await typeInto(page.locator("#investmentPeriod"), "25");
      await page.getByRole("button", { name: new RegExp("^" + name) }).click();
      await expect(page.locator("#annualContribution")).toHaveValue(inr(deposit));
      await expect(page.locator("#annualContributionSlider")).toHaveValue(String(deposit));
      await expect(page.locator("#investmentPeriod")).toHaveValue("15");
      await expect(page.locator("#interestRate")).toHaveValue("7.1");
      await expectResults(page, deposit, 15, 7.1);
    });
  }

  test("sliders at their minimum and maximum, and fields move the sliders", async ({ page }) => {
    await sliderTo(page.locator("#annualContributionSlider"), "max");
    await expect(page.locator("#annualContribution")).toHaveValue("1,50,000");
    await sliderTo(page.locator("#investmentPeriodSlider"), "max");
    await expect(page.locator("#investmentPeriod")).toHaveValue("30");
    await sliderTo(page.locator("#interestRateSlider"), "max");
    await expect(page.locator("#interestRate")).toHaveValue("8");
    await expectResults(page, 150000, 30, 8);

    await sliderTo(page.locator("#annualContributionSlider"), "min");
    await expect(page.locator("#annualContribution")).toHaveValue("500");
    await sliderTo(page.locator("#investmentPeriodSlider"), "min");
    await sliderTo(page.locator("#interestRateSlider"), "min");
    await expect(page.locator("#interestRate")).toHaveValue("6.5");
    await expectResults(page, 500, 15, 6.5);

    await setSlider(page.locator("#annualContributionSlider"), 75000);
    await expect(page.locator("#annualContribution")).toHaveValue("75,000");
    await typeInto(page.locator("#annualContribution"), "90000");
    await expect(page.locator("#annualContributionSlider")).toHaveValue("90000");
    await typeInto(page.locator("#investmentPeriod"), "22");
    await expect(page.locator("#investmentPeriodSlider")).toHaveValue("22");
    await typeInto(page.locator("#interestRate"), "7.4");
    await expect(page.locator("#interestRateSlider")).toHaveValue("7.4");
    await expectResults(page, 90000, 22, 7.4);
  });

  test("out-of-range entries are explained and pulled back into range", async ({ page, dialogs }) => {
    const amount = page.locator("#annualContribution");
    await typeInto(amount, "200");
    await amount.blur();
    expect(dialogs.messages.at(-1)).toMatch(/between ₹500 and ₹1,50,000/);
    await expect(amount).toHaveValue("500");
    await typeInto(amount, "250000");
    await amount.blur();
    await expect(amount).toHaveValue("1,50,000");
    await expectResults(page, 150000, 15, 7.1);

    const years = page.locator("#investmentPeriod");
    await typeInto(years, "10");
    await years.blur();
    expect(dialogs.messages.at(-1)).toMatch(/minimum period is 15 years/i);
    await expect(years).toHaveValue("15");
  });

  test("Indian grouping in the contribution", async ({ page }) => {
    await expectIndianGrouping(page.locator("#annualContribution"));
  });

  test("Reset restores the defaults", async ({ page }) => {
    await typeInto(page.locator("#annualContribution"), "40000");
    await typeInto(page.locator("#interestRate"), "7.9");
    await page.getByRole("button", { name: "Reset Calculator" }).click();
    await expect(page.locator("#annualContribution")).toHaveValue("1,00,000");
    await expect(page.locator("#interestRate")).toHaveValue("7.1");
    await expectResults(page, 100000, 15, 7.1);
  });

  test("figures are saved and come back after a reload", async ({ page }) => {
    await typeInto(page.locator("#annualContribution"), "120000");
    await typeInto(page.locator("#investmentPeriod"), "20");
    await typeInto(page.locator("#interestRate"), "7.5");
    await page.locator("#investmentPeriod").click();
    await page.reload();
    await expect(page.locator("#annualContribution")).toHaveValue("1,20,000");
    await expect(page.locator("#investmentPeriod")).toHaveValue("20");
    await expect(page.locator("#interestRate")).toHaveValue("7.5");
    await expectResults(page, 120000, 20, 7.5);
  });

  test("the partial withdrawal follows the PPF rule", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: the page shows 50% of the balance at the end of year 7. PPF Scheme, 2019, para 9(1) allows 50% of
    // the LOWER of the balance at the end of the 4th year before the withdrawal year and at the end of the
    // preceding year. For a withdrawal after 7 full years (year 8) that is 50% of the year-4 balance: about
    // ₹2.38 lakh on the default plan, not the ₹4.65 lakh shown. (A withdrawal in year 7 itself, the first allowed,
    // uses the year-3 balance, which is lower still.) The page's own rules box says "Up to 50% of balance (4 years
    // prior)", so the calculator disagrees with its own text.
    const b = ppfBalances(100000, 7.1, 15);
    await expectAmount(page.locator("#partialWithdrawal"), ppfWithdrawalLimit(b, 8));
  });

  test("the yearly tax saving includes the 4% cess", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: "30% tax bracket saves ₹30,000" leaves out the 4% Health and Education Cess (Finance Act,
    // 2026, s.3(15)). A 1 lakh deduction in the 30% slab cuts tax by 30% x 1.04 = ₹31,200 (before any surcharge).
    await expectAmount(page.locator("#taxSavings"), 100000 * 0.3 * 1.04);
  });

  test("Share sends the maturity value on WhatsApp", async ({ page }) => {
    const shown = (await page.locator("#maturityValue").innerText()).trim();
    await expectWhatsAppShare(page, /share/i, ["PPF Maturity", shown]);
  });
});
