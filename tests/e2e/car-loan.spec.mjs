// Car Loan calculator (/car-loan-calculator/).
// On-road price = ex-showroom + road tax (a % of ex-showroom) + insurance + accessories + other charges.
// Loan = on-road - down payment. EMI from the standard reducing-balance formula (tests/lib/reference.mjs).
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, typeInto, inr } from "./fixtures.mjs";
import { emi } from "../lib/reference.mjs";

const DEFAULTS = { price: 1000000, down: 200000, rate: 9.5, years: 5, insurance: 25000, rto: 10, accessories: 0, other: 15000 };

function expected(x) {
  const rto = (x.price * x.rto) / 100;
  const onRoad = x.price + rto + x.insurance + x.accessories + x.other;
  const loan = onRoad - x.down;
  const n = x.years * 12;
  const e = emi(loan, x.rate, n);
  return { rto, onRoad, loan, n, emi: e, totalEmi: e * n, interest: e * n - loan };
}

async function fillAll(page, x) {
  const ids = { price: "carPrice", down: "downPayment", rate: "interestRate", years: "loanTenure", insurance: "insurance", rto: "rtoTax", accessories: "accessories", other: "otherCharges" };
  for (const [k, id] of Object.entries(ids)) if (x[k] !== undefined) await setField(page.locator("#" + id), x[k]);
}

async function expectResults(page, x) {
  const r = expected(x);
  await expect(page.locator("#results")).toBeVisible();
  await expectAmount(page.locator("#monthlyEMI"), r.emi, { slack: 0.5, label: "EMI" });
  await expectAmount(page.locator("#onRoadPrice"), r.onRoad, { slack: 0.5, label: "on-road price" });
  await expectAmount(page.locator("#loanAmount"), r.loan, { slack: 0.5, label: "loan" });
  await expectAmount(page.locator("#totalInterest"), r.interest, { slack: 0.5, label: "total interest" });
  await expectAmount(page.locator("#exShowroomPrice"), x.price, { label: "ex-showroom" });
  await expectAmount(page.locator("#rtoAmount"), r.rto, { slack: 0.5, label: "road tax" });
  await expectAmount(page.locator("#insuranceAmount"), x.insurance, { label: "insurance" });
  await expectAmount(page.locator("#accessoriesAmount"), x.accessories, { label: "accessories" });
  await expectAmount(page.locator("#otherChargesAmount"), x.other, { label: "other charges" });
  await expectAmount(page.locator("#totalOnRoadPrice"), r.onRoad, { slack: 0.5, label: "total on-road" });
  await expectAmount(page.locator("#downPaymentDisplay"), x.down, { label: "down payment" });
  await expectAmount(page.locator("#totalEMIPayments"), r.totalEmi, { slack: 0.5, label: "total EMIs" });
  await expectAmount(page.locator("#totalInterestDisplay"), r.interest, { slack: 0.5, label: "interest paid" });
  await expectAmount(page.locator("#totalAmountPaid"), x.down + r.totalEmi, { slack: 0.5, label: "total paid" });
  // The page labels this "Interest as % of Car Price" (ex-showroom)
  await expect(page.locator("#interestPercentage")).toHaveText(((r.interest / x.price) * 100).toFixed(1) + "%");
  await expect(page.locator("#totalMonths")).toHaveText(`${r.n} months`);
  await expect(page.locator("#downPaymentPercent")).toHaveText(((x.down / r.onRoad) * 100).toFixed(1) + "%");
}

test.describe("Car Loan calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/car-loan-calculator/");
  });

  test("opens with the default new car worked out", async ({ page }) => {
    await expect(page.getByRole("radio", { name: "New Car" })).toBeChecked();
    await expect(page.locator("#carPrice")).toHaveValue("10,00,000");
    await expectResults(page, DEFAULTS);
    await expectNoBadNumbers(page);
  });

  test("every field feeds the result", async ({ page }) => {
    const x = { price: 1850000, down: 400000, rate: 8.8, years: 7, insurance: 62000, rto: 12.5, accessories: 35000, other: 22000 };
    await fillAll(page, x);
    await page.getByRole("button", { name: "Calculate EMI" }).click();
    await expect(page.locator("#results")).toBeInViewport();
    await expectResults(page, x);
  });

  test("shortest and longest tenure, lowest and highest rate", async ({ page }) => {
    for (const [rate, years] of [[5, 1], [20, 7]]) {
      const x = { ...DEFAULTS, rate, years };
      await fillAll(page, x);
      await page.getByRole("button", { name: "Calculate EMI" }).click();
      await expectResults(page, x);
    }
  });

  test("no optional costs and no road tax", async ({ page }) => {
    const x = { ...DEFAULTS, insurance: 0, rto: 0, accessories: 0, other: 0 };
    await fillAll(page, x);
    await page.getByRole("button", { name: "Calculate EMI" }).click();
    await expectResults(page, x);
  });

  test("Used Car sets a used-car rate range, New Car puts it back", async ({ page }) => {
    const rate = page.locator("#interestRate");
    await page.getByRole("radio", { name: "Used Car" }).check();
    await expect(rate).toHaveValue("13");
    await expect(rate).toHaveAttribute("min", "12");
    await expect(rate).toHaveAttribute("max", "20");
    await page.getByRole("button", { name: "Calculate EMI" }).click();
    await expectResults(page, { ...DEFAULTS, rate: 13 });

    await page.getByRole("radio", { name: "New Car" }).check();
    await expect(rate).toHaveValue("9.5");
    await expect(rate).toHaveAttribute("min", "7.6");
    await expect(rate).toHaveAttribute("max", "15");
    await page.getByRole("button", { name: "Calculate EMI" }).click();
    await expectResults(page, DEFAULTS);
  });

  test("Indian grouping in the five rupee fields", async ({ page }) => {
    for (const id of ["carPrice", "downPayment", "insurance", "accessories", "otherCharges"]) {
      await expectIndianGrouping(page.locator("#" + id));
    }
  });

  test("Reset asks first and restores the defaults", async ({ page, dialogs }) => {
    await fillAll(page, { price: 2500000, down: 500000, rate: 11, years: 3 });
    await page.getByRole("radio", { name: "Used Car" }).check();
    dialogs.respond = "dismiss";
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.locator("#carPrice")).toHaveValue("25,00,000");
    dialogs.respond = "accept";
    await page.getByRole("button", { name: "Reset" }).click();
    expect(dialogs.messages.length).toBe(2);
    await expect(page.getByRole("radio", { name: "New Car" })).toBeChecked();
    await expect(page.locator("#carPrice")).toHaveValue("10,00,000");
    await expect(page.locator("#interestRate")).toHaveValue("9.5");
    await expect(page.locator("#loanTenure")).toHaveValue("5");
    await page.getByRole("button", { name: "Calculate EMI" }).click();
    await expectResults(page, DEFAULTS);
  });

  test("rate and tenure are saved and come back after a reload", async ({ page }) => {
    await typeInto(page.locator("#interestRate"), "10.5");
    await typeInto(page.locator("#loanTenure"), "4");
    await typeInto(page.locator("#rtoTax"), "8");
    await page.reload();
    await expect(page.locator("#interestRate")).toHaveValue("10.5");
    await expect(page.locator("#loanTenure")).toHaveValue("4");
    await expect(page.locator("#rtoTax")).toHaveValue("8");
    await expectResults(page, { ...DEFAULTS, rate: 10.5, years: 4, rto: 8 });
  });

  test("a typed car price is saved and comes back after a reload", async ({ page }) => {
    // FIXED 2026-11-06 in main.js, kept as a regression test. Was a known bug: auto-save loses Indian-formatted amounts (see home-loan.spec.mjs for the cause).
    await typeInto(page.locator("#carPrice"), "1500000");
    await page.locator("#loanTenure").click();
    await page.reload();
    await expect(page.locator("#carPrice")).toHaveValue("15,00,000");
  });

  test("the Used Car choice is saved and comes back after a reload", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: initAutoSave stores a radio button's value ("used") and on reload writes it back into the
    // radio's value attribute instead of ticking it. The restore also fires the radio's change handler, which
    // sets the rate to 13%. Result: "New Car" is ticked while the rate shows the used-car 13%.
    await page.getByRole("radio", { name: "Used Car" }).check();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Used Car" })).toBeChecked();
    await expect(page.locator("#interestRate")).toHaveValue("13");
  });

  test("0% interest gives an EMI of loan / months, not NaN", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: at 0% the formula divides 0 by 0 and the page shows ₹NaN. An interest-free loan's EMI is
    // simply the loan divided by the number of months (zero-cost EMI offers work this way).
    const x = { ...DEFAULTS, rate: 0 };
    await fillAll(page, x);
    await page.getByRole("button", { name: "Calculate EMI" }).click();
    await expectNoBadNumbers(page);
    const r = expected(x);
    await expectAmount(page.locator("#monthlyEMI"), r.loan / r.n, { slack: 0.5 });
  });

  test("a down payment above the on-road price never shows a negative loan or EMI", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: no check, so a 20 lakh down payment on an 11.4 lakh car shows a negative loan and EMI.
    await fillAll(page, { down: 2000000 });
    await page.getByRole("button", { name: "Calculate EMI" }).click();
    for (const id of ["#loanAmount", "#monthlyEMI", "#totalInterest"]) {
      await expect(page.locator(id)).not.toContainText("-");
    }
  });

  test("Share sends the EMI on WhatsApp", async ({ page }) => {
    const r = expected(DEFAULTS);
    await expectWhatsAppShare(page, /share/i, ["Car Loan EMI", "₹" + inr(r.emi)]);
  });
});
