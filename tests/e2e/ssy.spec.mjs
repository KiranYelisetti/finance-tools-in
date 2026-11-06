// Sukanya Samriddhi (SSY) calculator (/ssy-calculator/).
// reference.ssyBalances: deposits for 15 years, maturity after 21 years, yearly compounding, each deposit credited
// for the whole year (SSA Scheme, 2019). Partial withdrawal: 50% of the balance at the end of the year before the
// application, once she is 18.
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, setSlider, sliderTo, typeInto, inr } from "./fixtures.mjs";
import { ssyBalances, ssyWithdrawalAt18 } from "../lib/reference.mjs";

async function expectResults(page, age, deposit, rate) {
  const b = ssyBalances(deposit, rate);
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#placeholder")).toBeHidden();
  await expectAmount(page.locator("#maturityValue"), b[21], { label: "maturity" });
  await expectAmount(page.locator("#totalInvestment"), deposit * 15, { label: "deposits" });
  await expectAmount(page.locator("#totalInterest"), b[21] - deposit * 15, { label: "interest" });
  await expectAmount(page.locator("#taxBenefit"), Math.min(deposit, 150000), { label: "deduction" });
  await expectAmount(page.locator("#partialWithdrawal"), ssyWithdrawalAt18(b, age), { label: "withdrawal at 18" });
  await expect(page.locator("#breakdown")).toContainText(`from age ${age} to ${age + 15}`);
  await expect(page.locator("#breakdown")).toContainText(`when she turns ${age + 21}`);
}

test.describe("Sukanya Samriddhi calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ssy-calculator/");
  });

  test("opens with a 5-year-old, 1 lakh a year at 8.2%", async ({ page }) => {
    await expect(page.locator("#annualDeposit")).toHaveValue("1,00,000");
    await expectResults(page, 5, 100000, 8.2);
    await expectNoBadNumbers(page);
  });

  const plans = [[0, 250, 8.2], [10, 150000, 8.2], [3, 50000, 7.6], [8, 120000, 8.8], [1, 75000, 8]];
  for (const [age, deposit, rate] of plans) {
    test(`age ${age}, ${inr(deposit)} a year at ${rate}%`, async ({ page }) => {
      await typeInto(page.locator("#currentAge"), String(age));
      await typeInto(page.locator("#annualDeposit"), String(deposit));
      await typeInto(page.locator("#interestRate"), String(rate));
      await expectResults(page, age, deposit, rate);
    });
  }

  for (const [name, deposit] of [["Small", 50000], ["Medium", 100000], ["Maximum", 150000]]) {
    test(`preset ${name}`, async ({ page }) => {
      await typeInto(page.locator("#currentAge"), "2");
      await page.getByRole("button", { name: new RegExp("^" + name) }).click();
      await expect(page.locator("#currentAge")).toHaveValue("5");
      await expect(page.locator("#annualDeposit")).toHaveValue(inr(deposit));
      await expect(page.locator("#annualDepositSlider")).toHaveValue(String(deposit));
      await expectResults(page, 5, deposit, 8.2);
    });
  }

  test("sliders at their minimum and maximum, and fields move the sliders", async ({ page }) => {
    await sliderTo(page.locator("#annualDepositSlider"), "max");
    await expect(page.locator("#annualDeposit")).toHaveValue("1,50,000");
    await sliderTo(page.locator("#interestRateSlider"), "max");
    await expect(page.locator("#interestRate")).toHaveValue("8.8");
    await expectResults(page, 5, 150000, 8.8);
    await sliderTo(page.locator("#annualDepositSlider"), "min");
    await expect(page.locator("#annualDeposit")).toHaveValue("250");
    await sliderTo(page.locator("#interestRateSlider"), "min");
    await expect(page.locator("#interestRate")).toHaveValue("7.6");
    await expectResults(page, 5, 250, 7.6);
    await setSlider(page.locator("#annualDepositSlider"), 80000);
    await expect(page.locator("#annualDeposit")).toHaveValue("80,000");
    await typeInto(page.locator("#annualDeposit"), "60000");
    await expect(page.locator("#annualDepositSlider")).toHaveValue("60000");
    await typeInto(page.locator("#interestRate"), "8");
    await expect(page.locator("#interestRateSlider")).toHaveValue("8");
    await expectResults(page, 5, 60000, 8);
  });

  test("ages and deposits out of range are explained and pulled back", async ({ page, dialogs }) => {
    const age = page.locator("#currentAge");
    await typeInto(age, "12");
    await age.blur();
    expect(dialogs.messages.at(-1)).toMatch(/under 10/i);
    await expect(age).toHaveValue("10");
    await expectResults(page, 10, 100000, 8.2);

    const deposit = page.locator("#annualDeposit");
    await typeInto(deposit, "100");
    await deposit.blur();
    expect(dialogs.messages.at(-1)).toMatch(/between ₹250 and ₹1,50,000/);
    await expect(deposit).toHaveValue("250");
    await typeInto(deposit, "200000");
    await deposit.blur();
    await expect(deposit).toHaveValue("1,50,000");
  });

  test("an empty field leaves the last figures and never shows NaN", async ({ page }) => {
    for (const id of ["#currentAge", "#annualDeposit", "#interestRate"]) {
      await setField(page.locator(id), "");
      await expectNoBadNumbers(page);
      await page.goto("/ssy-calculator/");
    }
  });

  test("Indian grouping in the deposit", async ({ page }) => {
    await expectIndianGrouping(page.locator("#annualDeposit"));
  });

  test("Reset restores the defaults", async ({ page }) => {
    await typeInto(page.locator("#currentAge"), "9");
    await typeInto(page.locator("#annualDeposit"), "30000");
    await page.getByRole("button", { name: "Reset Calculator" }).click();
    await expect(page.locator("#currentAge")).toHaveValue("5");
    await expect(page.locator("#annualDeposit")).toHaveValue("1,00,000");
    await expectResults(page, 5, 100000, 8.2);
  });

  test("figures are saved and come back after a reload", async ({ page }) => {
    await typeInto(page.locator("#currentAge"), "7");
    await typeInto(page.locator("#annualDeposit"), "90000");
    await typeInto(page.locator("#interestRate"), "8.1");
    await page.locator("#currentAge").click();
    await page.reload();
    await expect(page.locator("#currentAge")).toHaveValue("7");
    await expect(page.locator("#annualDeposit")).toHaveValue("90,000");
    await expect(page.locator("#interestRate")).toHaveValue("8.1");
    await expectResults(page, 7, 90000, 8.1);
  });

  test("a part-year age still shows the withdrawal at 18", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: the balance at 18 is picked with an exact match (age + year === 18), so an age typed as
    // 5.5 never matches and "Available at Age 18" shows ₹0. The field accepts decimals.
    await setField(page.locator("#currentAge"), "5.5");
    const shown = await page.locator("#partialWithdrawal").textContent();
    expect(Number(shown.replace(/[^\d.]/g, ""))).toBeGreaterThan(0);
  });

  test("the yearly tax saving includes the 4% cess", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: same as PPF, "30% tax bracket saves" leaves out the 4% cess: ₹31,200, not ₹30,000.
    await expectAmount(page.locator("#taxSavings"), 100000 * 0.3 * 1.04);
  });

  test("Share sends the maturity value on WhatsApp", async ({ page }) => {
    const shown = (await page.locator("#maturityValue").innerText()).trim();
    await expectWhatsAppShare(page, /share/i, ["SSY Maturity", shown]);
  });
});
