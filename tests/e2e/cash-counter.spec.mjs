// Cash Counter (/cash-counter/). Total = sum of count x face value for every note and coin.
import { test, expect, expectAmount, expectNoBadNumbers, expectWhatsAppShare, setField, typeInto, inr } from "./fixtures.mjs";
import { DENOMINATIONS } from "../lib/reference.mjs";

const IDS = Object.keys(DENOMINATIONS);

async function count(page, counts) {
  for (const [id, n] of Object.entries(counts)) await setField(page.locator("#" + id), String(n));
}
const totalOf = (counts) => Object.entries(counts).reduce((s, [id, n]) => s + n * DENOMINATIONS[id], 0);

test.describe("Cash Counter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cash-counter/");
  });

  test("starts at zero", async ({ page }) => {
    for (const id of IDS) await expect(page.locator("#" + id)).toHaveValue("0");
    await expect(page.locator("#totalAmount")).toHaveText("₹0");
    await expect(page.locator("#totalInWords")).toHaveText("");
  });

  for (const id of IDS) {
    test(`counts ${id}`, async ({ page }) => {
      await typeInto(page.locator("#" + id), "37");
      await expect(page.locator("#totalAmount")).toHaveText("₹" + inr(37 * DENOMINATIONS[id]));
    });
  }

  test("a mixed till", async ({ page }) => {
    const till = { note2000: 3, note500: 41, note200: 17, note100: 63, note50: 22, note20: 35, note10: 48, coin20: 4, coin10: 19, coin5: 27, coin2: 31, coin1: 56 };
    await count(page, till);
    await expectAmount(page.locator("#totalAmount"), totalOf(till));
    await expect(page.locator("#totalInWords")).not.toHaveText("");
  });

  test("every box at the 99,999 limit", async ({ page }) => {
    const all = Object.fromEntries(IDS.map((id) => [id, 99999]));
    await count(page, all);
    await expect(page.locator("#totalAmount")).toHaveText("₹" + inr(totalOf(all)));
  });

  test("more than 99,999 is cut to 99,999 and a negative count to 0", async ({ page }) => {
    await setField(page.locator("#note500"), "150000");
    await expect(page.locator("#note500")).toHaveValue("99999");
    await expect(page.locator("#totalAmount")).toHaveText("₹" + inr(99999 * 500));
    await setField(page.locator("#note500"), "-5");
    await expect(page.locator("#note500")).toHaveValue("0");
    await expect(page.locator("#totalAmount")).toHaveText("₹0");
  });

  test("an emptied box counts as zero", async ({ page }) => {
    await count(page, { note100: 5, coin1: 3 });
    await setField(page.locator("#note100"), "");
    await expect(page.locator("#totalAmount")).toHaveText("₹3");
    await expectNoBadNumbers(page);
  });

  test("Recalculate gives the same total", async ({ page }) => {
    await count(page, { note200: 12, coin2: 7 });
    await page.getByRole("button", { name: "Recalculate" }).click();
    await expect(page.locator("#totalAmount")).toHaveText("₹" + inr(12 * 200 + 7 * 2));
  });

  test("Reset All asks first and clears every box", async ({ page, dialogs }) => {
    await count(page, { note500: 10, coin10: 4 });
    dialogs.respond = "dismiss";
    await page.getByRole("button", { name: "Reset All" }).click();
    await expect(page.locator("#note500")).toHaveValue("10");
    dialogs.respond = "accept";
    await page.getByRole("button", { name: "Reset All" }).click();
    for (const id of IDS) await expect(page.locator("#" + id)).toHaveValue("0");
    await expect(page.locator("#totalAmount")).toHaveText("₹0");
  });

  test("counts are saved and come back after a reload", async ({ page }) => {
    await typeInto(page.locator("#note500"), "12");
    await typeInto(page.locator("#coin5"), "9");
    await page.reload();
    await expect(page.locator("#note500")).toHaveValue("12");
    await expect(page.locator("#coin5")).toHaveValue("9");
    await expect(page.locator("#totalAmount")).toHaveText("₹" + inr(12 * 500 + 9 * 5));
  });

  test("the total in words is written in words", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: the page promises the total "in words" but prints digits with unit names: 15,750 shows as
    // "15 Thousand 7 Hundred 50 Rupees". Written out it is "Fifteen Thousand Seven Hundred Fifty Rupees" (the
    // site's own Number to Words engine, src/js/number-words.js, already does this).
    await count(page, { note500: 31, note200: 1, note50: 1 }); // 15,500 + 200 + 50 = 15,750
    await expect(page.locator("#totalAmount")).toHaveText("₹15,750");
    await expect(page.locator("#totalInWords")).toHaveText(/^Fifteen Thousand Seven Hundred Fifty Rupees/);
  });

  test("Share sends the total on WhatsApp", async ({ page }) => {
    await count(page, { note100: 7 });
    await expectWhatsAppShare(page, /share total/i, ["Cash Count", "₹700"]);
  });
});
