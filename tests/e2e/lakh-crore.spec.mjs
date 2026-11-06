// Lakh Crore in Numbers (/lakh-crore-in-numbers/).
// One lakh crore = 1,00,000 x 1,00,00,000 = 10^12 rupees, which is one trillion. Expected digits are built here
// with BigInt from that definition, not read from the page.
import { test, expect, setField, typeInto } from "./fixtures.mjs";
import { groupIndian } from "../lib/reference.mjs";

/** Rupees in `v` lakh crore, exactly: "9.08" -> 9080000000000n. */
function lakhCrore(v) {
  const [whole, frac = ""] = String(v).split(".");
  return BigInt(whole + frac.padEnd(12, "0").slice(0, 12));
}
const zeros = (n) => (String(n).match(/0/g) || []).length;

test.describe("Lakh Crore in Numbers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/lakh-crore-in-numbers/");
  });

  test("opens with 9.8 lakh crore", async ({ page }) => {
    const r = lakhCrore("9.8");
    await expect(page.locator("#lcInput")).toHaveValue("9.8");
    await expect(page.locator("#lcDigits")).toHaveText(groupIndian(r));
    await expect(page.locator("#lcWords")).toHaveText("Nine Lakh Eighty Thousand Crore");
    await expect(page.locator("#lcMeta")).toHaveText(`${groupIndian(r / 10n ** 7n)} crore · 9.8 trillion · ${String(r).length} digits, ${zeros(r)} zeros`);
  });

  const values = [
    ["270", "Two Hundred Seventy Lakh Crore"],
    ["1.44", "One Lakh Forty Four Thousand Crore"],
    ["9.08", "Nine Lakh Eight Thousand Crore"],
    ["1", "One Lakh Crore"],
    ["99999", "Ninety Nine Thousand Nine Hundred Ninety Nine Lakh Crore"],
  ];
  for (const [v, words] of values) {
    test(`${v} lakh crore`, async ({ page }) => {
      const r = lakhCrore(v);
      await typeInto(page.locator("#lcInput"), v);
      await expect(page.locator("#lcError")).toBeHidden();
      await expect(page.locator("#lcDigits")).toHaveText(groupIndian(r));
      await expect(page.locator("#lcWords")).toHaveText(words);
      await expect(page.locator("#lcMeta")).toHaveText(`${groupIndian(r / 10n ** 7n)} crore · ${v} trillion · ${String(r).length} digits, ${zeros(r)} zeros`);
    });
  }

  test("units typed by hand are read as written", async ({ page }) => {
    await setField(page.locator("#lcInput"), "5 crore");
    await expect(page.locator("#lcDigits")).toHaveText("5,00,00,000");
    await expect(page.locator("#lcWords")).toHaveText("Five Crore");
    const r = 5n * 10n ** 7n;
    await expect(page.locator("#lcMeta")).toHaveText(`5 crore · 0.00005 trillion · ${String(r).length} digits, ${zeros(r)} zeros`);
  });

  test("a figure with paise keeps them", async ({ page }) => {
    // 0.0000000000015 lakh crore = 1.5 rupees
    await setField(page.locator("#lcInput"), "1.5 rupees");
    await expect(page.locator("#lcDigits")).toHaveText("1.50");
    await expect(page.locator("#lcWords")).toContainText("Fifty Paise");
  });

  test("too large or not a number shows an error, empty shows none", async ({ page }) => {
    await setField(page.locator("#lcInput"), "100000");
    await expect(page.locator("#lcError")).toBeVisible();
    await setField(page.locator("#lcInput"), "abc");
    await expect(page.locator("#lcError")).toBeVisible();
    await expect(page.locator("#lcError")).not.toHaveText("");
    await setField(page.locator("#lcInput"), "");
    await expect(page.locator("#lcError")).toBeHidden();
  });

  test("every row of the lakh crore table is right", async ({ page }) => {
    const table = page.getByRole("table");
    const headers = (await table.getByRole("columnheader").allTextContents()).map((h) => h.trim());
    const col = (name) => headers.findIndex((h) => h.toLowerCase().startsWith(name));
    const [cLakh, cCrore, cDigits, cTrillion, cZeros] = ["lakh crore", "crore", "in digits", "trillion", "zeros"].map(col);
    expect(Math.min(cLakh, cCrore, cDigits, cTrillion, cZeros)).toBeGreaterThanOrEqual(0);
    const rows = await table.locator("tbody").getByRole("row").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((td) => td.textContent.trim())));
    expect(rows.length).toBeGreaterThan(20);
    for (const cells of rows) {
      const v = cells[cLakh].replace(/\s*lakh crore$/, "");
      const r = lakhCrore(v);
      expect(cells[cCrore], `${v}: crore`).toBe(groupIndian(r / 10n ** 7n));
      expect(cells[cDigits], `${v}: digits`).toBe(groupIndian(r));
      expect(cells[cTrillion], `${v}: trillion`).toBe(v);
      expect(cells[cZeros], `${v}: zeros`).toBe(String(zeros(r)));
    }
    // Each figure links to the converter with the amount filled in
    const link = table.getByRole("link", { name: "270 lakh crore", exact: true });
    await expect(link).toHaveAttribute("href", "/number-to-words/?n=" + encodeURIComponent("270 lakh crore"));
  });
});
