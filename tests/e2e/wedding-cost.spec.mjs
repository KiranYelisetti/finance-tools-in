// Wedding Cost calculator (/wedding-cost-calculator/).
// Future cost = budget today x (1 + inflation)^years, plus 20% for a destination wedding, plus gold growing at the
// page's stated 10% a year. Monthly saving: reference.sipNeededForGoal at 12% a year.
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, setSlider, sliderTo, typeInto } from "./fixtures.mjs";
import { grow, sipNeededForGoal } from "../lib/reference.mjs";

function expected({ budget = 2000000, years = 5, inflation = 8, destination = false, gold = false, goldAmount = 500000 }) {
  const wedding = grow(budget, inflation, years);
  const premium = destination ? wedding * 0.2 : 0;
  const goldThen = gold ? grow(goldAmount, 10, years) : 0;
  const total = wedding + premium + goldThen;
  const today = budget * (destination ? 1.2 : 1) + (gold ? goldAmount : 0);
  return { wedding, premium, goldThen, total, today, sip: sipNeededForGoal(total, 12, years * 12) };
}

async function expectResults(page, x) {
  const r = expected(x);
  await expect(page.locator("#results")).toBeVisible();
  await expectAmount(page.locator("#totalCost"), r.total, { label: "total then" });
  await expectAmount(page.locator("#currentCost"), r.today, { label: "if done today" });
  await expect(page.locator("#costIncrease")).toHaveText("+" + ((r.total / r.today - 1) * 100).toFixed(1) + "%");
  await expect(page.locator("#resultYears")).toHaveText(String(x.years ?? 5));
  await expectAmount(page.locator("#monthlySIP"), r.sip, { label: "monthly saving" });
  if (x.gold) {
    await expect(page.locator("#goldCostRow")).toBeVisible();
    await expectAmount(page.locator("#goldCost"), r.goldThen, { label: "gold" });
  } else {
    await expect(page.locator("#goldCostRow")).toBeHidden();
  }
  if (x.destination) {
    await expect(page.locator("#destinationCostRow")).toBeVisible();
    await expectAmount(page.locator("#destinationCost"), r.premium, { label: "destination premium" });
  } else {
    await expect(page.locator("#destinationCostRow")).toBeHidden();
    await expectAmount(page.locator("#weddingCost"), r.wedding, { label: "wedding expenses" });
  }
  return r;
}

test.describe("Wedding Cost calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wedding-cost-calculator/");
  });

  test("opens with 20 lakh in 5 years at 8%", async ({ page }) => {
    await expect(page.getByLabel(/Destination/)).not.toBeChecked();
    await expect(page.locator("#goldAmountSection")).toBeHidden();
    await expectResults(page, {});
    await expectNoBadNumbers(page);
  });

  test("destination wedding adds 20%", async ({ page }) => {
    await page.getByLabel(/Destination/).check();
    await expectResults(page, { destination: true });
    await page.getByLabel(/Destination/).uncheck();
    await expectResults(page, {});
  });

  test("gold jewellery grows at 10% a year", async ({ page }) => {
    await page.getByLabel(/Gold Jewelry/).check();
    await expect(page.locator("#goldAmountSection")).toBeVisible();
    await expectResults(page, { gold: true });
    await typeInto(page.locator("#goldAmount"), "800000");
    await expectResults(page, { gold: true, goldAmount: 800000 });
    await page.getByLabel(/Gold Jewelry/).uncheck();
    await expect(page.locator("#goldAmountSection")).toBeHidden();
    await expectResults(page, {});
  });

  for (const [name, preset] of [
    [/Simple & Sweet/, { budget: 1200000, years: 5, inflation: 8, destination: false, gold: false, goldAmount: 300000 }],
    [/Middle Class/, { budget: 2500000, years: 5, inflation: 8, destination: false, gold: true, goldAmount: 500000 }],
    [/Grand Wedding/, { budget: 5000000, years: 7, inflation: 9, destination: true, gold: true, goldAmount: 1000000 }],
  ]) {
    test(`preset ${name.source}`, async ({ page }) => {
      await page.getByRole("button", { name }).click();
      await expect(page.locator("#inflationValue")).toHaveText(String(preset.inflation));
      await expect(page.getByLabel(/Destination/)).toBeChecked({ checked: preset.destination });
      await expect(page.getByLabel(/Gold Jewelry/)).toBeChecked({ checked: preset.gold });
      await expectResults(page, preset);
    });
  }

  test("years and the inflation slider at their limits", async ({ page }) => {
    await typeInto(page.locator("#currentBudget"), "1500000");
    await typeInto(page.locator("#yearsToWedding"), "1");
    await sliderTo(page.locator("#weddingInflation"), "min");
    await expect(page.locator("#inflationValue")).toHaveText("5");
    await expectResults(page, { budget: 1500000, years: 1, inflation: 5 });
    await typeInto(page.locator("#yearsToWedding"), "20");
    await sliderTo(page.locator("#weddingInflation"), "max");
    await expect(page.locator("#inflationValue")).toHaveText("15");
    await expectResults(page, { budget: 1500000, years: 20, inflation: 15 });
    await setSlider(page.locator("#weddingInflation"), 9.5);
    await page.getByRole("button", { name: "Calculate Wedding Cost" }).click();
    await expectResults(page, { budget: 1500000, years: 20, inflation: 9.5 });
  });

  test("an empty budget or zero years hides the result", async ({ page }) => {
    await setField(page.locator("#currentBudget"), "");
    await expect(page.locator("#results")).toBeHidden();
    await expect(page.locator("#placeholder")).toBeVisible();
    await setField(page.locator("#currentBudget"), "2000000");
    await setField(page.locator("#yearsToWedding"), "0");
    await expect(page.locator("#results")).toBeHidden();
  });

  test("the cost breakdown adds up to the total", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: with a destination wedding, "Wedding expenses" already includes the 20% premium and the
    // "Destination premium" line repeats it, so the lines add up to more than the total. For 20 lakh in 5 years at
    // 8% the lines show ₹35.26 lakh + ₹5.88 lakh against a total of ₹35.26 lakh. "Wedding expenses" should be
    // ₹29.39 lakh.
    await page.getByLabel(/Destination/).check();
    const r = expected({ destination: true });
    await expectAmount(page.locator("#weddingCost"), r.wedding, { label: "wedding expenses without the premium" });
  });

  test("Indian grouping in the budget and gold amount", async ({ page }) => {
    await expectIndianGrouping(page.locator("#currentBudget"));
    await page.getByLabel(/Gold Jewelry/).check();
    await expectIndianGrouping(page.locator("#goldAmount"));
  });

  test("Reset asks first and restores the defaults", async ({ page, dialogs }) => {
    await page.getByRole("button", { name: /Grand Wedding/ }).click();
    await page.getByRole("button", { name: "Reset" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/reset/i);
    await expect(page.locator("#currentBudget")).toHaveValue("20,00,000");
    await expect(page.locator("#yearsToWedding")).toHaveValue("5");
    await expect(page.getByLabel(/Destination/)).not.toBeChecked();
    await expect(page.getByLabel(/Gold Jewelry/)).not.toBeChecked();
    await expect(page.locator("#goldAmountSection")).toBeHidden();
    await expectResults(page, {});
  });

  test("choices are saved and come back after a reload", async ({ page }) => {
    await typeInto(page.locator("#currentBudget"), "3500000");
    await typeInto(page.locator("#yearsToWedding"), "6");
    await page.getByLabel(/Destination/).check();
    await page.getByLabel(/Gold Jewelry/).check();
    await typeInto(page.locator("#goldAmount"), "700000");
    await page.reload();
    await expect(page.locator("#currentBudget")).toHaveValue("35,00,000");
    await expect(page.locator("#yearsToWedding")).toHaveValue("6");
    await expect(page.getByLabel(/Destination/)).toBeChecked();
    await expect(page.getByLabel(/Gold Jewelry/)).toBeChecked();
    await expect(page.locator("#goldAmountSection")).toBeVisible();
    await expect(page.locator("#goldAmount")).toHaveValue("7,00,000");
    await expectResults(page, { budget: 3500000, years: 6, destination: true, gold: true, goldAmount: 700000 });
  });

  test("Share sends the total on WhatsApp", async ({ page }) => {
    const shown = (await page.locator("#totalCost").innerText()).trim();
    await expectWhatsAppShare(page, "Share Result", ["Wedding Cost", shown]);
  });
});
