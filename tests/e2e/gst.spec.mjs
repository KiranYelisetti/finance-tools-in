// GST calculator (/gst-calculator/).
// Add GST: tax = value x rate / 100. Remove GST: tax inside an inclusive amount = amount x rate / (100 + rate).
// Within a state: CGST and SGST, half each. Between states: IGST, all of it. (reference.gst)
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, typeInto } from "./fixtures.mjs";
import { gst } from "../lib/reference.mjs";

// Rate labels written out by hand: the rate and the half rate the page should show for CGST and SGST.
const RATES = [
  ["0", "0%", "0%"], ["5", "5%", "2.5%"], ["18", "18%", "9%"], ["40", "40%", "20%"],
  ["3", "3%", "1.5%"], ["0.25", "0.25%", "0.125%"], ["12", "12%", "6%"], ["28", "28%", "14%"],
];

const money = (x) => "₹" + x.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function expectResults(page, amount, rate, mode, { rateLabel, halfLabel } = {}) {
  const r = gst(amount, rate, mode);
  await expectAmount(page.locator("#originalAmount"), r.base, { label: "amount before GST" });
  await expectAmount(page.locator("#gstAmount"), r.tax, { label: "GST" });
  await expectAmount(page.locator("#finalAmount"), r.total, { label: "amount with GST" });
  await expectAmount(page.locator("#cgstAmount"), r.cgst, { label: "CGST" });
  await expectAmount(page.locator("#sgstAmount"), r.sgst, { label: "SGST" });
  await expectAmount(page.locator("#igstAmount"), r.igst, { label: "IGST" });
  if (rateLabel) {
    await expect(page.locator("#rateDisplay")).toHaveText(rateLabel);
    await expect(page.locator("#igstRate")).toHaveText(rateLabel);
    await expect(page.locator("#cgstRate")).toHaveText(halfLabel);
    await expect(page.locator("#sgstRate")).toHaveText(halfLabel);
  }
}

test.describe("GST calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gst-calculator/");
  });

  test("opens adding 18% to 1,000 within a state", async ({ page }) => {
    await expect(page.locator("#gstRate")).toHaveValue("18");
    await expect(page.locator("#originalAmount")).toHaveText(money(1000));
    await expect(page.locator("#gstAmount")).toHaveText(money(180));
    await expect(page.locator("#finalAmount")).toHaveText(money(1180));
    await expect(page.locator("#cgstAmount")).toHaveText(money(90));
    await expect(page.locator("#intraBreakdown")).toBeVisible();
    await expect(page.locator("#interBreakdown")).toBeHidden();
    await expect(page.locator("#customRateDiv")).toBeHidden();
    await expectResults(page, 1000, 18, "add", { rateLabel: "18%", halfLabel: "9%" });
  });

  for (const [value, rateLabel, halfLabel] of RATES) {
    test(`add and remove GST at ${rateLabel}`, async ({ page }) => {
      await page.locator("#gstRate").selectOption(value);
      await setField(page.locator("#amount"), "23450");
      await expectResults(page, 23450, Number(value), "add", { rateLabel, halfLabel });
      await expect(page.locator("#originalLabel")).toHaveText("Amount (Before GST)");
      await page.getByRole("button", { name: "Remove GST" }).click();
      await expectResults(page, 23450, Number(value), "remove", { rateLabel, halfLabel });
      await expect(page.locator("#originalLabel")).toHaveText("Amount (Without GST)");
      await expect(page.locator("#finalLabel")).toHaveText("Original Amount (With GST)");
      await page.getByRole("button", { name: "Add GST" }).click();
      await expect(page.locator("#finalLabel")).toHaveText("Total Amount (With GST)");
    });
  }

  test("between states shows IGST only, within a state shows CGST and SGST", async ({ page }) => {
    await page.getByRole("button", { name: "Between states" }).click();
    await expect(page.locator("#interBreakdown")).toBeVisible();
    await expect(page.locator("#intraBreakdown")).toBeHidden();
    await expectResults(page, 1000, 18, "add", { rateLabel: "18%", halfLabel: "9%" });
    await page.getByRole("button", { name: "Within state" }).click();
    await expect(page.locator("#intraBreakdown")).toBeVisible();
    await expect(page.locator("#interBreakdown")).toBeHidden();
  });

  test("custom rate: shown when chosen, clamped to 0-100", async ({ page }) => {
    await page.locator("#gstRate").selectOption("custom");
    await expect(page.locator("#customRateDiv")).toBeVisible();
    await setField(page.locator("#customRate"), "7.5");
    await expectResults(page, 1000, 7.5, "add", { rateLabel: "7.5%", halfLabel: "3.75%" });
    await setField(page.locator("#customRate"), "150");
    await expectResults(page, 1000, 100, "add", { rateLabel: "100%", halfLabel: "50%" });
    await setField(page.locator("#customRate"), "-5");
    await expectResults(page, 1000, 0, "add", { rateLabel: "0%", halfLabel: "0%" });
    await page.locator("#gstRate").selectOption("5");
    await expect(page.locator("#customRateDiv")).toBeHidden();
  });

  test("paise and large amounts", async ({ page }) => {
    for (const amount of [0.99, 1, 99999.99, 12345678.9]) {
      await setField(page.locator("#amount"), String(amount));
      await expectResults(page, amount, 18, "add");
    }
    await page.getByRole("button", { name: "Remove GST" }).click();
    await setField(page.locator("#amount"), "1180");
    await expect(page.locator("#originalAmount")).toHaveText(money(1000));
    await expect(page.locator("#gstAmount")).toHaveText(money(180));
  });

  test("zero or empty amount shows ₹0.00 everywhere", async ({ page }) => {
    for (const v of ["0", ""]) {
      await setField(page.locator("#amount"), v);
      for (const id of ["originalAmount", "gstAmount", "finalAmount", "cgstAmount", "sgstAmount", "igstAmount"]) {
        await expect(page.locator("#" + id)).toHaveText("₹0.00");
      }
      await expectNoBadNumbers(page);
    }
  });

  test("the Calculate GST button works", async ({ page }) => {
    await page.locator("#amount").evaluate((el) => { el.value = "5000"; });
    await page.getByRole("button", { name: "Calculate GST" }).click();
    await expectResults(page, 5000, 18, "add");
  });

  test("Indian grouping in the amount", async ({ page }) => {
    await expectIndianGrouping(page.locator("#amount"));
  });

  test("an amount with paise can be typed key by key", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: the Indian-format field (main.js setupIndianInputs) reformats on every key. "1000." becomes
    // "1,000", so the decimal point vanishes and the next key adds a digit: typing 1000.50 gives 1,00,050.
    // Pasting works; typing paise does not.
    await typeInto(page.locator("#amount"), "1000.50");
    await expectResults(page, 1000.5, 18, "add");
  });

  test("Reset asks first and restores the defaults", async ({ page, dialogs }) => {
    await setField(page.locator("#amount"), "777");
    await page.locator("#gstRate").selectOption("custom");
    await setField(page.locator("#customRate"), "9");
    await page.getByRole("button", { name: "Reset" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/reset/i);
    await expect(page.locator("#amount")).toHaveValue("1,000");
    await expect(page.locator("#gstRate")).toHaveValue("18");
    await expect(page.locator("#customRate")).toHaveValue("18");
    await expect(page.locator("#customRateDiv")).toBeHidden();
    await expectResults(page, 1000, 18, "add");
  });

  test("amount and rate are saved and come back after a reload", async ({ page }) => {
    await typeInto(page.locator("#amount"), "250000");
    await page.locator("#gstRate").selectOption("custom");
    await setField(page.locator("#customRate"), "2.5");
    await page.reload();
    await expect(page.locator("#amount")).toHaveValue("2,50,000");
    await expect(page.locator("#gstRate")).toHaveValue("custom");
    await expect(page.locator("#customRateDiv")).toBeVisible();
    await expectResults(page, 250000, 2.5, "add");
  });

  test("Share sends the total on WhatsApp", async ({ page }) => {
    await expectWhatsAppShare(page, /share/i, ["GST Calculation", money(1180)]);
  });
});
