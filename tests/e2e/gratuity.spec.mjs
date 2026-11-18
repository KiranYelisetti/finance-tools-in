// Gratuity Calculator (/gratuity-calculator/). The law and the sums are covered by tests/unit/gratuity.test.mjs. Here:
// the page shows those sums correctly, explains each outcome and copes with empty or impossible input.
import { test, expect, expectAmount, expectNoBadNumbers, expectWhatsAppShare, setField, press } from "./fixtures.mjs";

const wage = (w, years) => (w * 15) / 26 * years;

async function fill(page, { join, last, basic, other, type, reason }) {
  if (join !== undefined) await setField(page.locator("#joinDate"), join);
  if (last !== undefined) await setField(page.locator("#lastDay"), last);
  if (basic !== undefined) await setField(page.locator("#basicDA"), basic);
  if (other !== undefined) await setField(page.locator("#otherPay"), other);
  if (type) await page.locator("#empType").selectOption(type);
  if (reason) await page.locator("#exitReason").selectOption(reason);
}

test.describe("Gratuity Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gratuity-calculator/");
  });

  test("opens with a worked example under the Code", async ({ page }) => {
    await expectAmount(page.locator("#payable"), wage(50000, 8));
    await expect(page.locator("#lawUsed")).toHaveText("Code on Social Security, 2020");
    await expect(page.locator("#serviceText")).toHaveText("8 years, 5 months, 0 days");
    await expect(page.locator("#yearsCounted")).toHaveText("8");
    await expectAmount(page.locator("#wageUsed"), 50000);
    await expectAmount(page.locator("#halfRule"), 10000);
    await expectAmount(page.locator("#oldAmount"), wage(40000, 8));
    await expectAmount(page.locator("#extraAmount"), wage(10000, 8));
    await expectAmount(page.locator("#taxFree"), wage(40000, 8));
    await expectAmount(page.locator("#taxable"), wage(10000, 8));
    await expect(page.locator("#verdict")).toHaveText("Due for 8 years of service.");
    await expectNoBadNumbers(page);
  });

  test("a part year of more than six months counts, exactly six months does not", async ({ page }) => {
    await fill(page, { join: "2020-01-01", last: "2025-12-31", basic: 26000, other: 0 });
    await expect(page.locator("#yearsCounted")).toHaveText("6");
    await fill(page, { join: "2020-01-01", last: "2026-06-30" });
    await expect(page.locator("#serviceText")).toHaveText("6 years, 6 months, 0 days");
    await expect(page.locator("#yearsCounted")).toHaveText("6");
    await expectAmount(page.locator("#payable"), 90000);
    await fill(page, { last: "2026-07-01" });
    await expect(page.locator("#yearsCounted")).toHaveText("7");
    await expectAmount(page.locator("#payable"), 105000);
  });

  test("under five years a permanent employee is told it is not due", async ({ page }) => {
    await fill(page, { join: "2022-01-01", last: "2026-10-31", basic: 30000, other: 10000 });
    await expectAmount(page.locator("#payable"), 0);
    await expect(page.locator("#verdict")).toContainText("Not due yet");
    await expect(page.locator("#verdict")).toContainText("5 years");
    await expect(page.locator("#compareWrap")).toBeHidden();
    await expectAmount(page.locator("#taxFree"), 0);
    await expectAmount(page.locator("#taxable"), 0);
  });

  test("a fixed-term employee qualifies after one year", async ({ page }) => {
    await fill(page, { join: "2025-04-01", last: "2026-10-31", basic: 26000, other: 14000, type: "fixedTerm", reason: "contractEnd" });
    await expect(page.locator("#yearsCounted")).toHaveText("2");
    await expectAmount(page.locator("#payable"), 30000);
    await expect(page.locator("#notes")).toContainText("one year under the contract");
    await fill(page, { join: "2025-12-01", last: "2026-10-31" });
    await expect(page.locator("#verdict")).toContainText("1 year");
    await expectAmount(page.locator("#payable"), 0);
  });

  test("death needs no minimum service and the page says part years may differ", async ({ page }) => {
    await fill(page, { join: "2024-01-01", last: "2025-12-31", basic: 30000, other: 0, reason: "death" });
    await expectAmount(page.locator("#payable"), wage(30000, 2));
    await expect(page.locator("#notes")).toContainText("pro rata");
  });

  test("leaving before 21 November 2025 uses the old Act and basic plus DA", async ({ page }) => {
    await fill(page, { join: "2015-01-01", last: "2025-11-20", basic: 20000, other: 40000 });
    await expect(page.locator("#lawUsed")).toHaveText("Payment of Gratuity Act, 1972");
    await expectAmount(page.locator("#wageUsed"), 20000);
    await expectAmount(page.locator("#halfRule"), 0);
    await expect(page.locator("#compareWrap")).toBeHidden();
    await expect(page.locator("#notes")).toContainText("1972 Act applies");
    await fill(page, { last: "2025-11-21" });
    await expect(page.locator("#lawUsed")).toHaveText("Code on Social Security, 2020");
    await expectAmount(page.locator("#wageUsed"), 30000);
  });

  test("the ₹20 lakh ceiling is applied and explained", async ({ page }) => {
    await fill(page, { join: "2011-11-01", last: "2026-10-31", basic: 250000, other: 100000 });
    await expectAmount(page.locator("#payable"), 2000000);
    await expect(page.locator("#verdict")).toContainText("ceiling applies");
    await expectAmount(page.locator("#taxFree"), 2000000);
    await expectAmount(page.locator("#taxable"), 0);
  });

  test("empty or impossible input gives a message and no figures", async ({ page }) => {
    await fill(page, { join: "" });
    await expect(page.locator("#formError")).toContainText("joining date");
    await expect(page.locator("#results")).toBeHidden();
    await fill(page, { join: "2027-01-01" });
    await expect(page.locator("#formError")).toContainText("after the joining date");
    await fill(page, { join: "2018-06-01", basic: "" });
    await expect(page.locator("#formError")).toContainText("basic pay");
    await expect(page.locator("#results")).toBeHidden();
    await fill(page, { basic: 40000 });
    await expect(page.locator("#formError")).toBeHidden();
    await expect(page.locator("#results")).toBeVisible();
    await expectNoBadNumbers(page);
  });

  test("the entries survive a reload and Reset restores the example", async ({ page }) => {
    await fill(page, { basic: 30000, other: 0, join: "2015-01-01" });
    await page.reload();
    await expect(page.locator("#basicDA")).toHaveValue("30,000");
    await expect(page.locator("#joinDate")).toHaveValue("2015-01-01");
    await press(page, "Reset");
    await expect(page.locator("#joinDate")).toHaveValue("2018-06-01");
    await expectAmount(page.locator("#payable"), wage(50000, 8));
  });

  test("the result can be shared on WhatsApp", async ({ page }) => {
    await expectWhatsAppShare(page, "Share via WhatsApp", "2,30,769");
  });

  test("the worked examples table matches the calculator", async ({ page }) => {
    const row = page.getByRole("row", { name: /Permanent, high pay/ });
    await expect(row).toContainText("₹20,00,000 (ceiling)");
    await expect(page.getByRole("row", { name: /Fixed-term contract ₹26,000/ })).toContainText("₹30,000");
  });
});
