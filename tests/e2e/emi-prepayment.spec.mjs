// EMI Prepayment calculator (/emi-prepayment-calculator/).
// The EMI stays as it was; a monthly extra is paid with every EMI and a lump sum is paid at once, before the first
// EMI ("a bonus ... you can pay immediately"). The loan is simulated month by month in tests/lib/reference.mjs.
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, typeInto, inr } from "./fixtures.mjs";
import { emi, amortise } from "../lib/reference.mjs";

const TODAY = new Date("2026-11-06T10:00:00+05:30");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function expected({ P, rate, years, extra = 0, lump = 0 }) {
  const n = years * 12;
  const e = emi(P, rate, n);
  const plain = { interest: e * n - P, paid: e * n };
  const pre = extra || lump ? amortise({ principal: P, annualPct: rate, emi: e, maxMonths: 2 * n, extraMonthly: extra, lumpAtStart: lump }) : { months: n, ...plain };
  return { n, emi: e, plain, pre, monthsSaved: n - pre.months, saved: plain.interest - pre.interest, totalSaved: plain.paid - pre.paid };
}

const plural = (k, word) => `${k} ${word}${k > 1 ? "s" : ""}`;
function savedText(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(plural(y, "year"));
  if (m) parts.push(plural(m, "month"));
  return parts.join(" ") || "0 months";
}

async function fill(page, { P, rate, years, extra, lump }) {
  if (P !== undefined) await setField(page.locator("#loanAmount"), P);
  if (rate !== undefined) await setField(page.locator("#interestRate"), rate);
  if (years !== undefined) await setField(page.locator("#loanTenure"), years);
  if (extra !== undefined) await setField(page.locator("#monthlyExtra"), extra);
  if (lump !== undefined) await setField(page.locator("#lumpSum"), lump);
}

async function expectResults(page, x) {
  const r = expected(x);
  await expect(page.locator("#results")).toBeVisible();
  await expectAmount(page.locator("#interestSaved"), r.saved, { slack: 1, label: "interest saved" });
  await expect(page.locator("#timeSaved")).toHaveText(savedText(r.monthsSaved));
  const end = TODAY.getFullYear() * 12 + TODAY.getMonth() + r.pre.months;
  await expect(page.locator("#newEndDate")).toHaveText(new RegExp(`^${MONTHS[end % 12]}\\w*\\.? ${Math.floor(end / 12)}$`));
  await expectAmount(page.locator("#origEMI"), r.emi, { slack: 0.5, label: "EMI" });
  await expect(page.locator("#newEMI")).toContainText(" + ");
  await expectAmount(page.locator("#origTenure"), x.years, { label: "years" });
  await expect(page.locator("#origTenure")).toHaveText(`${x.years} years (${r.n} months)`);
  await expect(page.locator("#newTenure")).toHaveText(`${Math.floor(r.pre.months / 12)} yrs ${r.pre.months % 12} months`);
  await expect(page.locator("#tenureSaved")).toHaveText(savedText(r.monthsSaved) + " saved!");
  await expectAmount(page.locator("#origInterest"), r.plain.interest, { slack: 0.5, label: "interest without" });
  await expectAmount(page.locator("#newInterest"), r.pre.interest, { slack: 0.5, label: "interest with" });
  await expectAmount(page.locator("#interestSavedTable"), r.saved, { slack: 1, label: "interest saved (table)" });
  await expectAmount(page.locator("#origTotal"), r.plain.paid, { slack: 0.5, label: "total without" });
  await expectAmount(page.locator("#newTotal"), r.pre.paid, { slack: 0.5, label: "total with" });
  await expectAmount(page.locator("#totalSaved"), r.totalSaved, { slack: 1, label: "total saved" });
  return r;
}

test.describe("EMI Prepayment calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
    await page.goto("/emi-prepayment-calculator/");
  });

  const DEFAULTS = { P: 5000000, rate: 9, years: 20, extra: 10000, lump: 0 };

  test("opens with the default plan worked out", async ({ page }) => {
    await expect(page.locator("#loanAmount")).toHaveValue("50,00,000");
    await expectResults(page, DEFAULTS);
    await expectAmount(page.locator("#newEMI"), emi(5000000, 9, 240), { slack: 0.5 });
    await expectNoBadNumbers(page);
  });

  const plans = [
    [{ P: 2500000, rate: 8.5, years: 15, extra: 0, lump: 300000 }, "lump sum only"],
    [{ P: 2500000, rate: 8.5, years: 15, extra: 5000, lump: 300000 }, "lump sum and monthly extra"],
    [{ P: 800000, rate: 12, years: 5, extra: 2000, lump: 0 }, "car loan size"],
    [{ P: 300000, rate: 18, years: 3, extra: 1000, lump: 50000 }, "personal loan, high rate"],
    [{ P: 100000, rate: 5, years: 1, extra: 100, lump: 0 }, "smallest amount and lowest rate"],
    [{ P: 50000000, rate: 20, years: 30, extra: 100000, lump: 0 }, "5 crore at the highest rate"],
  ];
  for (const [x, label] of plans) {
    test(`savings: ${label}`, async ({ page }) => {
      await fill(page, x);
      await page.getByRole("button", { name: "Calculate Savings" }).click();
      await expect(page.locator("#results")).toBeInViewport();
      await expectResults(page, x);
    });
  }

  test("no prepayment saves nothing", async ({ page }) => {
    await fill(page, { extra: 0, lump: 0 });
    await page.getByRole("button", { name: "Calculate Savings" }).click();
    await expectResults(page, { ...DEFAULTS, extra: 0, lump: 0 });
    await expect(page.locator("#timeSaved")).toHaveText("0 months");
  });

  test("the loan type list can be changed (it does not change any figure)", async ({ page }) => {
    for (const option of ["Car Loan", "Personal Loan", "Home Loan"]) {
      await page.locator("#loanType").selectOption({ label: option });
      await page.getByRole("button", { name: "Calculate Savings" }).click();
      await expectResults(page, DEFAULTS);
    }
  });

  test("Indian grouping in the three rupee fields", async ({ page }) => {
    for (const id of ["loanAmount", "monthlyExtra", "lumpSum"]) await expectIndianGrouping(page.locator("#" + id));
  });

  test("a zero rate or empty amount leaves the last figures and never shows NaN", async ({ page }) => {
    await fill(page, { rate: 0 });
    await page.getByRole("button", { name: "Calculate Savings" }).click();
    await expectNoBadNumbers(page);
    await fill(page, { rate: 9, P: "" });
    await page.getByRole("button", { name: "Calculate Savings" }).click();
    await expectNoBadNumbers(page);
  });

  test("a lump sum larger than the loan counts only what was owed", async ({ page }) => {
    // KNOWN BUG: a 60 lakh lump sum on a 50 lakh loan is added in full to "total paid with prepayment" (₹60 lakh),
    // so the table claims you pay more than you owed. Paying off the loan at once costs exactly the 50 lakh owed.
    test.fail();
    await fill(page, { extra: 0, lump: 6000000 });
    await page.getByRole("button", { name: "Calculate Savings" }).click();
    await expectAmount(page.locator("#newTotal"), 5000000, { slack: 0.5 });
  });

  test("Reset asks first and restores the defaults", async ({ page, dialogs }) => {
    await fill(page, { P: 1200000, rate: 11, years: 7, extra: 3000, lump: 100000 });
    await page.locator("#loanType").selectOption("car");
    dialogs.respond = "accept";
    await page.getByRole("button", { name: "Reset" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/reset/i);
    await expect(page.locator("#loanAmount")).toHaveValue("50,00,000");
    await expect(page.locator("#interestRate")).toHaveValue("9");
    await expect(page.locator("#loanTenure")).toHaveValue("20");
    await expect(page.locator("#monthlyExtra")).toHaveValue("10,000");
    await expect(page.locator("#lumpSum")).toHaveValue("0");
    await expect(page.locator("#loanType")).toHaveValue("home");
    await page.getByRole("button", { name: "Calculate Savings" }).click();
    await expectResults(page, DEFAULTS);
  });

  test("rate, tenure and loan type are saved and come back after a reload", async ({ page }) => {
    await typeInto(page.locator("#interestRate"), "8.25");
    await typeInto(page.locator("#loanTenure"), "15");
    await page.locator("#loanType").selectOption("personal");
    await page.reload();
    await expect(page.locator("#interestRate")).toHaveValue("8.25");
    await expect(page.locator("#loanTenure")).toHaveValue("15");
    await expect(page.locator("#loanType")).toHaveValue("personal");
    await expectResults(page, { ...DEFAULTS, rate: 8.25, years: 15 });
  });

  test("a typed monthly extra is saved and comes back after a reload", async ({ page }) => {
    // KNOWN BUG: auto-save loses Indian-formatted amounts (see home-loan.spec.mjs for the cause).
    test.fail();
    await typeInto(page.locator("#monthlyExtra"), "15000");
    await page.locator("#interestRate").click();
    await page.reload();
    await expect(page.locator("#monthlyExtra")).toHaveValue("15,000");
  });

  test("Share sends the interest saved on WhatsApp", async ({ page }) => {
    const r = expected(DEFAULTS);
    const shown = await page.locator("#interestSaved").textContent();
    await expectWhatsAppShare(page, /share/i, ["EMI Prepayment Savings", shown + " saved!"]);
    expect(Math.abs(Number(shown.replace(/[^\d.]/g, "")) * 1e5 - r.saved)).toBeLessThan(1000);
  });
});
