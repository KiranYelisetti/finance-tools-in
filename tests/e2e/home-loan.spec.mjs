// Home Loan EMI calculator (/home-loan-calculator/).
// Expected EMIs come from the standard reducing-balance formula and a month-by-month schedule written in
// tests/lib/reference.mjs, not from the page. The page states its prepayment convention: a prepayment "at the
// end of every year from year N", which reference.amortise follows.
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, typeInto, inr } from "./fixtures.mjs";
import { emi, amortise } from "../lib/reference.mjs";

const URL_ = "/home-loan-calculator/";

function expected(P, rate, years, prepay = null) {
  const n = years * 12;
  const e = emi(P, rate, n);
  const plain = amortise({ principal: P, annualPct: rate, emi: e, maxMonths: n });
  const out = { emi: e, n, totalInterest: e * n - P, totalPaid: e * n, yearOne: plain.yearOne, plainInterest: plain.interest };
  if (prepay) {
    const pre = amortise({ principal: P, annualPct: rate, emi: e, maxMonths: n, yearly: prepay });
    out.saved = plain.interest - pre.interest;
    out.months = pre.months;
  }
  return out;
}

async function fill(page, { amount, rate, years }) {
  if (amount !== undefined) await setField(page.locator("#loanAmount"), amount);
  if (rate !== undefined) await setField(page.locator("#interestRate"), rate);
  if (years !== undefined) await setField(page.locator("#loanTenure"), years);
}

async function expectResults(page, P, rate, years) {
  const x = expected(P, rate, years);
  await expectAmount(page.locator("#monthlyEMI"), x.emi, { label: "EMI" });
  await expect(page.locator("#emiLine")).toHaveText(`every month for ${x.n} months, at ${rate}% a year`);
  await expectAmount(page.locator("#principalAmount"), P, { firstLine: true, label: "principal" });
  await expectAmount(page.locator("#totalInterest"), x.totalInterest, { firstLine: true, slack: 0.5, label: "total interest" });
  await expectAmount(page.locator("#totalAmount"), x.totalPaid, { firstLine: true, slack: 0.5, label: "total paid" });
  await expect(page.locator("#totalMonths")).toHaveText(`${x.n} months`);
  await expectAmount(page.locator("#emiRatio"), x.emi / (P / 100000), { label: "EMI per lakh" });
  const pShare = Math.round((P / x.totalPaid) * 100);
  await expect(page.locator("#principalInterestRatio")).toHaveText(`${pShare} : ${100 - pShare}`);
  // Old-regime deductions on the first year's schedule: interest capped at 2,00,000 (Income-tax Act 2025 s.22(2)),
  // principal capped at 1,50,000 (s.123).
  const i24 = Math.min(200000, x.yearOne.interest);
  const p80 = Math.min(150000, x.yearOne.principal);
  await expectAmount(page.locator("#taxBenefit24b"), i24, { firstLine: true, label: "interest deduction" });
  await expectAmount(page.locator("#taxBenefit80c"), p80, { firstLine: true, label: "principal deduction" });
  await expectAmount(page.locator("#totalTaxBenefit"), i24 + p80, { slack: 0.5, label: "total deduction" });
  return x;
}

test.describe("Home Loan EMI calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL_);
  });

  test("opens with the default 50 lakh, 8.5%, 20 years worked out", async ({ page }) => {
    await expect(page.locator("#loanAmount")).toHaveValue("50,00,000");
    await expect(page.locator("#results")).toBeVisible();
    await expectResults(page, 5000000, 8.5, 20);
    await expect(page.locator("#loanAmountWords")).toHaveText("Fifty Lakh Rupees");
    await expect(page.locator("#prepaymentResults")).toBeHidden();
    await expectNoBadNumbers(page);
  });

  test("updates as you type", async ({ page }) => {
    await typeInto(page.locator("#loanAmount"), "3500000");
    await expect(page.locator("#loanAmount")).toHaveValue("35,00,000");
    await typeInto(page.locator("#interestRate"), "8.4");
    await typeInto(page.locator("#loanTenure"), "15");
    await expectResults(page, 3500000, 8.4, 15);
    await expect(page.locator("#loanAmountWords")).toHaveText("Thirty Five Lakh Rupees");
  });

  const grid = [
    [100000, 5, 1, "smallest amount, lowest rate, shortest tenure"],
    [100000000, 15, 30, "10 crore, highest rate, longest tenure"],
    [2500000, 9.15, 7, "an odd rate"],
    [7500000, 8.75, 25, "the 75 lakh row"],
  ];
  for (const [P, rate, years, label] of grid) {
    test(`EMI for ${inr(P)} at ${rate}% over ${years} years (${label})`, async ({ page }) => {
      await fill(page, { amount: P, rate, years });
      await page.getByRole("button", { name: "Calculate" }).click();
      await expectResults(page, P, rate, years);
    });
  }

  test("Calculate shows the results, and on a phone scrolls to them", async ({ page }, testInfo) => {
    await fill(page, { amount: 4000000, rate: 8, years: 20 });
    await page.getByRole("button", { name: "Calculate" }).click();
    await expect(page.locator("#results")).toBeVisible();
    if (testInfo.project.name === "phone") await expect(page.locator("#results")).toBeInViewport();
    await expectResults(page, 4000000, 8, 20);
  });

  test("Indian grouping in the amount fields", async ({ page }) => {
    await expectIndianGrouping(page.locator("#loanAmount"));
    await page.getByLabel("Add a prepayment every year").check();
    await expectIndianGrouping(page.locator("#prepaymentAmount"));
  });

  test("yearly prepayment: the page's own example (50 lakh, 8.6%, 20 years, 1 lakh a year from year 3)", async ({ page }) => {
    await fill(page, { amount: 5000000, rate: 8.6, years: 20 });
    const box = page.getByLabel("Add a prepayment every year");
    await box.check();
    await expect(page.locator("#prepaymentSection")).toBeVisible();
    await setField(page.locator("#prepaymentAmount"), "100000");
    await setField(page.locator("#prepaymentStartYear"), "3");
    const x = expected(5000000, 8.6, 20, { amount: 100000, fromYear: 3 });
    await expect(page.locator("#prepaymentResults")).toBeVisible();
    await expectAmount(page.locator("#interestSaved"), x.saved, { firstLine: true, slack: 0.5, label: "interest saved" });
    await expect(page.locator("#tenureReduced")).toHaveText(((240 - x.months) / 12).toFixed(1) + " years");
    await expect(page.locator("#newTenure")).toHaveText(`${(x.months / 12).toFixed(1)} years (${x.months} months)`);

    // The article quotes the same example, so it must agree with the schedule too
    const sentence = page.getByText(/On the first loan, a prepayment of/);
    await expect(sentence).toContainText(`saves ₹${inr(x.saved)} of interest`);
    await expect(sentence).toContainText(`closes the loan ${((240 - x.months) / 12).toFixed(1)} years early`);

    await box.uncheck();
    await expect(page.locator("#prepaymentSection")).toBeHidden();
    await expect(page.locator("#prepaymentResults")).toBeHidden();
  });

  test("prepayment from year 1, and one big enough to close the loan in the first year", async ({ page }) => {
    await fill(page, { amount: 2000000, rate: 9, years: 15 });
    await page.getByLabel("Add a prepayment every year").check();
    await setField(page.locator("#prepaymentStartYear"), "1");
    await setField(page.locator("#prepaymentAmount"), "250000");
    let x = expected(2000000, 9, 15, { amount: 250000, fromYear: 1 });
    await expectAmount(page.locator("#interestSaved"), x.saved, { firstLine: true, slack: 0.5 });
    await expect(page.locator("#newTenure")).toHaveText(`${(x.months / 12).toFixed(1)} years (${x.months} months)`);

    await setField(page.locator("#prepaymentAmount"), "5000000");
    x = expected(2000000, 9, 15, { amount: 5000000, fromYear: 1 });
    expect(x.months).toBe(12);
    await expect(page.locator("#newTenure")).toHaveText("1.0 years (12 months)");
    await expectAmount(page.locator("#interestSaved"), x.saved, { firstLine: true, slack: 0.5 });

    await setField(page.locator("#prepaymentAmount"), "0");
    await expectAmount(page.locator("#interestSaved"), 0, { firstLine: true, slack: 0.5 });
    await expect(page.locator("#tenureReduced")).toHaveText("0.0 years");
  });

  test("empty or zero fields never show NaN and keep the last good figures", async ({ page }) => {
    for (const id of ["#loanAmount", "#interestRate", "#loanTenure"]) {
      for (const v of ["", "0"]) {
        await setField(page.locator(id), v);
        await expectNoBadNumbers(page);
      }
      await setField(page.locator(id), { "#loanAmount": "5000000", "#interestRate": "8.5", "#loanTenure": "20" }[id]);
    }
    await expectResults(page, 5000000, 8.5, 20);
  });

  test("Reset asks first, Cancel keeps the figures, OK restores the defaults", async ({ page, dialogs }) => {
    await fill(page, { amount: 3000000, rate: 9.5, years: 10 });
    await page.getByLabel("Add a prepayment every year").check();
    dialogs.respond = "dismiss";
    await page.getByRole("button", { name: "Reset" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/reset all fields/i);
    await expect(page.locator("#loanAmount")).toHaveValue("30,00,000");

    dialogs.respond = "accept";
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.locator("#loanAmount")).toHaveValue("50,00,000");
    await expect(page.locator("#interestRate")).toHaveValue("8.5");
    await expect(page.locator("#loanTenure")).toHaveValue("20");
    await expect(page.getByLabel("Add a prepayment every year")).not.toBeChecked();
    await expect(page.locator("#prepaymentResults")).toBeHidden();
    await expectResults(page, 5000000, 8.5, 20);
  });

  test("rate, tenure and the prepayment settings are saved and come back after a reload", async ({ page }) => {
    await typeInto(page.locator("#interestRate"), "9");
    await typeInto(page.locator("#loanTenure"), "25");
    await page.getByLabel("Add a prepayment every year").check();
    await typeInto(page.locator("#prepaymentStartYear"), "5");
    await page.reload();
    await expect(page.locator("#interestRate")).toHaveValue("9");
    await expect(page.locator("#loanTenure")).toHaveValue("25");
    await expect(page.getByLabel("Add a prepayment every year")).toBeChecked();
    await expect(page.locator("#prepaymentSection")).toBeVisible();
    await expect(page.locator("#prepaymentStartYear")).toHaveValue("5");
  });

  test("a typed loan amount is saved and comes back after a reload", async ({ page }) => {
    // FIXED 2026-11-06 in main.js, kept as a regression test. Was a known bug (auto-save lost Indian-formatted amounts). The page's own <script> renders before /js/main.js, so
    // initAutoSave (run on DOMContentLoaded) restores "30,00,000" while the field is still type=number, before
    // setupIndianInputs turns it into a text field. The number field rejects the commas and the amount comes back
    // empty, so no results show. Same on Car Loan, EMI Prepayment, SIP, Income Tax and Salary.
    // initAutoSave now upgrades the Indian-format fields first and strips commas for any number field.
    await typeInto(page.locator("#loanAmount"), "3000000");
    await page.locator("#interestRate").click();
    await page.reload();
    await expect(page.locator("#loanAmount")).toHaveValue("30,00,000");
    await expectResults(page, 3000000, 8.5, 20);
  });

  test("Share on WhatsApp sends the EMI", async ({ page }) => {
    const x = expected(5000000, 8.5, 20);
    await expectWhatsAppShare(page, "Share on WhatsApp", ["Home Loan EMI", "₹" + inr(x.emi), "home-loan-calculator"]);
  });

  test("Print opens the print dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Print" }).click();
    expect(await page.evaluate(() => window.__printCalls)).toBe(1);
  });

  test("the worked examples and the EMI table agree with the EMI formula", async ({ page }) => {
    const toRupees = (label) => {
      const m = label.replace(/₹/g, "").trim().match(/^([\d.]+)\s*(lakh|crore)$/i);
      return Number(m[1]) * (/crore/i.test(m[2]) ? 1e7 : 1e5);
    };
    const examples = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Total interest" }) });
    const exRows = await examples.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent.trim())));
    expect(exRows.length).toBe(3);
    for (const [loan, rate, tenure, emiText, interestText] of exRows) {
      const P = toRupees(loan);
      const r = parseFloat(rate);
      const n = parseInt(tenure, 10) * 12;
      const e = emi(P, r, n);
      expect(Math.abs(Number(emiText.replace(/[₹,]/g, "")) - e), `${loan} EMI ${emiText}`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(Number(interestText.replace(/[₹,]/g, "")) - (e * n - P)), `${loan} interest ${interestText}`).toBeLessThanOrEqual(1);
    }

    const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "15 years" }) });
    const heading = await page.getByRole("heading", { name: /EMI for common loan amounts at/ }).textContent();
    const rate = parseFloat(heading.match(/at ([\d.]+)%/)[1]);
    const years = (await table.getByRole("columnheader").allTextContents()).slice(1).map((h) => parseInt(h, 10));
    const rows = await table.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent.trim())));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const [label, ...emis] of rows) {
      const P = toRupees(label);
      emis.forEach((text, i) => {
        const e = emi(P, rate, years[i] * 12);
        expect(Math.abs(Number(text.replace(/[₹,]/g, "")) - e), `${label} over ${years[i]} years: ${text}`).toBeLessThanOrEqual(0.5);
      });
    }
  });
});
