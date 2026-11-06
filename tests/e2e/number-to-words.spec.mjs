// Number to Words (/number-to-words/) and the home page's amount-in-words box.
// The cases are the hand-worked ones from tests/lib/number-words-cases.mjs (also run by scripts/test-number-words.mjs),
// typed into the real page here.
import { test, expect, setField, typeInto } from "./fixtures.mjs";
import { cases, errorCases } from "../lib/number-words-cases.mjs";
import { groupIndian } from "../lib/reference.mjs";

/** The Indian-grouped figure a case implies: its indianGrouped, or its rupees and paise grouped by hand. */
function groupedFor(expect) {
  if (expect.indianGrouped) return expect.indianGrouped;
  if (!expect.rupees) return null;
  const paise = expect.paise || 0;
  return groupIndian(expect.rupees) + (paise > 0 ? "." + String(paise).padStart(2, "0") : "");
}

test.describe("Number to Words page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/number-to-words/");
  });

  test("opens with 15 lakh worked out", async ({ page }) => {
    await expect(page.locator("#numberInput")).toHaveValue("1500000");
    await expect(page.locator("#answerMain")).toHaveText("Fifteen Lakh Rupees Only");
    await expect(page.locator("#answerSub")).toHaveText("₹15,00,000");
    await expect(page.locator("#answerMeta")).toHaveText("7 digits, 5 zeros · 1 Million 500 Thousand");
    await expect(page.locator("#inputError")).toBeHidden();
  });

  for (const [input, want] of cases) {
    test(`converts ${JSON.stringify(input)}`, async ({ page }) => {
      await setField(page.locator("#numberInput"), input);
      await expect(page.locator("#inputError")).toBeHidden();
      const grouped = groupedFor(want);
      if (grouped) await expect(page.locator("#indianGrouped")).toHaveText("₹" + grouped);
      if (want.indianFormat) await expect(page.locator("#indianFormat")).toHaveText(want.indianFormat);
      if (want.internationalFormat) await expect(page.locator("#internationalFormat")).toHaveText(want.internationalFormat);
      if (want.internationalGrouped) await expect(page.locator("#internationalGrouped")).toHaveText(want.internationalGrouped);
      if (want.inWords) await expect(page.locator("#inWords")).toHaveText(want.inWords);
      if (want.cheque) await expect(page.locator("#chequeFormat")).toHaveText(want.cheque);
      if (want.internationalWords) await expect(page.locator("#internationalWords")).toHaveText(want.internationalWords);
      if (want.digitCount !== undefined && want.zeroCount !== undefined) {
        await expect(page.locator("#answerMeta")).toContainText(`${want.digitCount} digits, ${want.zeroCount} zeros`);
      } else if (want.zeroCount !== undefined) {
        await expect(page.locator("#answerMeta")).toContainText(`, ${want.zeroCount} zeros`);
      }
      // The main answer is the digits when units were typed, the words when digits were typed.
      if (want.hasUnits === true && grouped) await expect(page.locator("#answerMain")).toHaveText(grouped);
      if (want.hasUnits === false && want.inWords) await expect(page.locator("#answerMain")).toHaveText(want.inWords);
    });
  }

  for (const bad of errorCases) {
    test(`shows an error for ${JSON.stringify(bad)}`, async ({ page }) => {
      await setField(page.locator("#numberInput"), bad);
      await expect(page.locator("#inputError")).toBeVisible();
      await expect(page.locator("#inputError")).not.toHaveText("");
    });
  }

  test("an empty box shows no error and keeps the last answer", async ({ page }) => {
    await setField(page.locator("#numberInput"), "");
    await expect(page.locator("#inputError")).toBeHidden();
    await expect(page.locator("#inWords")).toHaveText("Fifteen Lakh Rupees Only");
  });

  test("updates on every keystroke", async ({ page }) => {
    await typeInto(page.locator("#numberInput"), "2400000");
    await expect(page.locator("#answerMain")).toHaveText("Twenty Four Lakh Rupees Only");
    await expect(page.locator("#indianGrouped")).toHaveText("₹24,00,000");
  });

  const tryButtons = [
    ["1 lakh", "100000", "One Lakh Rupees Only"],
    ["15 lakh", "1500000", "Fifteen Lakh Rupees Only"],
    ["1 crore", "10000000", "One Crore Rupees Only"],
    ["1.5 crore to digits", "1.5 crore", groupIndian("15000000")],
    ["270 lakh crore", "270 lakh crore", groupIndian("270000000000000")],
    ["15 hazar crore", "15 hazar crore", groupIndian("150000000000")],
    ["2.5 million", "2.5 million", groupIndian("2500000")],
    ["1,250.75 with paise", "1250.75", "One Thousand Two Hundred Fifty Rupees and Seventy Five Paise Only"],
  ];
  for (const [name, value, main] of tryButtons) {
    test(`"Try" button ${name}`, async ({ page }) => {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.locator("#numberInput")).toHaveValue(value);
      await expect(page.locator("#answerMain")).toHaveText(main);
      await expect(page.locator("#answerBox")).toBeInViewport();
    });
  }

  const copyButtons = [
    ["Copy Indian format", "#indianGrouped"],
    ["Copy international format", "#internationalGrouped"],
    ["Copy amount in words", "#inWords"],
    ["Copy cheque format", "#chequeFormat"],
    ["Copy international words", "#internationalWords"],
  ];
  for (const [name, source] of copyButtons) {
    test(`"${name}" copies the line and says Copied`, async ({ page }) => {
      await setField(page.locator("#numberInput"), "1.5 crore");
      const button = page.getByRole("button", { name });
      await button.click();
      await expect(button).toHaveText("Copied");
      const expected = await page.locator(source).textContent();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
      await expect(button).toHaveText("Copy", { timeout: 3000 });
    });
  }

  test("a ?n= link opens with that amount filled in", async ({ page }) => {
    await page.goto("/number-to-words/?n=" + encodeURIComponent("1 cr 30 lakh"));
    await expect(page.locator("#numberInput")).toHaveValue("1 cr 30 lakh");
    await expect(page.locator("#answerMain")).toHaveText("1,30,00,000");
    await expect(page.locator("#answerSub")).toHaveText("One Crore Thirty Lakh Rupees Only");
    await expect(page.locator("#answerMeta")).toContainText("13000000");
  });
});

test.describe("Home page amount-in-words box", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("opens with 15 lakh in words", async ({ page }) => {
    await expect(page.locator("#homeAmount")).toHaveValue("15,00,000");
    await expect(page.locator("#homeWords")).toHaveText("Fifteen Lakh Rupees Only");
    await expect(page.locator("#homeDigits")).toHaveText("₹15,00,000, or 1 million 500 thousand");
    await expect(page.locator("#homeError")).toBeHidden();
  });

  for (const [input, want] of cases) {
    test(`home box: ${JSON.stringify(input)}`, async ({ page }) => {
      await setField(page.locator("#homeAmount"), input);
      await expect(page.locator("#homeError")).toBeHidden();
      const both = page.locator("#homeWords, #homeDigits");
      const grouped = groupedFor(want);
      if (want.inWords) await expect(both).toContainText([want.inWords]);
      if (grouped) await expect(both).toContainText(["₹" + grouped]);
      if (want.hasUnits === true && grouped) await expect(page.locator("#homeWords")).toHaveText("₹" + grouped);
      if (want.hasUnits === false && want.inWords) await expect(page.locator("#homeWords")).toHaveText(want.inWords);
    });
  }

  for (const bad of errorCases) {
    test(`home box shows an error for ${JSON.stringify(bad)}`, async ({ page }) => {
      await setField(page.locator("#homeAmount"), bad);
      await expect(page.locator("#homeError")).toBeVisible();
      await expect(page.locator("#homeError")).not.toHaveText("");
    });
  }

  test("an empty home box shows no error", async ({ page }) => {
    await setField(page.locator("#homeAmount"), "");
    await expect(page.locator("#homeError")).toBeHidden();
  });

  test("the more-formats link carries the amount to the converter", async ({ page }) => {
    await typeInto(page.locator("#homeAmount"), "1.5 crore");
    await expect(page.locator("#homeMore")).toHaveAttribute("href", "/number-to-words/?n=" + encodeURIComponent("1.5 crore"));
    await page.locator("#homeMore").click();
    await page.waitForURL("**/number-to-words/?n=*");
    await expect(page.locator("#numberInput")).toHaveValue("1.5 crore");
    await expect(page.locator("#answerMain")).toHaveText("1,50,00,000");
    await expect(page.locator("#chequeFormat")).toHaveText("Rupees One Crore Fifty Lakh Only");
  });

  test("the tool index links to all 20 tools", async ({ page }) => {
    // The home page tool grid (v2 design: a section titled "Pick a calculator", one tile per tool)
    const index = page.locator("main").getByRole("region", { name: "Pick a calculator" });
    const expected = {
      "Number to Words": "/number-to-words/", "Lakh Crore in Numbers": "/lakh-crore-in-numbers/", "Cash Counter": "/cash-counter/",
      "Home Loan EMI": "/home-loan-calculator/", "Car Loan": "/car-loan-calculator/", "EMI Prepayment": "/emi-prepayment-calculator/",
      "Income Tax": "/income-tax-calculator/", "Salary, CTC to In-hand": "/salary-calculator/", "GST": "/gst-calculator/",
      "SIP": "/sip-calculator/", "PPF": "/ppf-calculator/", "Sukanya Samriddhi": "/ssy-calculator/",
      "Study Abroad": "/study-abroad-calculator/", "Wedding Cost": "/wedding-cost-calculator/",
      "Age Calculator": "/age-calculator/", "Image Resizer": "/image-resizer/",
      "Word Counter": "/word-counter/", "QR Code Generator": "/qr-code-generator/", "JPG to PDF": "/jpg-to-pdf/", "Merge PDF": "/merge-pdf/",
    };
    const hrefs = await index.getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(new Set(hrefs)).toEqual(new Set(Object.values(expected)));
    for (const [name, href] of Object.entries(expected)) {
      await expect(index.getByRole("link", { name: new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toHaveAttribute("href", href);
    }
  });
});
