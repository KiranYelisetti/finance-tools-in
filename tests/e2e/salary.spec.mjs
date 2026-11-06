// Salary calculator, CTC to in-hand (/salary-calculator/).
// The page states its payslip conventions (basic % of CTC, HRA 50% or 40% of basic, PF 12% of basic, gratuity
// 4.81% of basic, employer ESI 3.25% up to 21,000 a month, new-regime tax). reference.salary follows them.
import { test, expect, expectAmount, expectIndianGrouping, expectNoBadNumbers, expectWhatsAppShare, setField, typeInto, inr } from "./fixtures.mjs";
import { salary } from "../lib/reference.mjs";

const RULE_279_CITIES = ["Mumbai", "Delhi", "Kolkata", "Chennai", "Hyderabad", "Bengaluru", "Pune", "Ahmedabad"];

async function fillAll(page, { ctc, city = "metro", basic = 40, bonus = 0, pt = 200 }) {
  await setField(page.locator("#annualCTC"), String(ctc));
  await page.locator("#cityType").selectOption(city);
  await setField(page.locator("#basicPercent"), String(basic));
  await setField(page.locator("#monthlyBonus"), String(bonus));
  await setField(page.locator("#profTax"), String(pt));
  await page.getByRole("button", { name: "Calculate In-Hand Salary" }).click();
}

async function expectResults(page, { ctc, city = "metro", basic = 40, bonus = 0, pt = 200 }) {
  const s = salary({ ctc, basicPct: basic, hraPct: city === "metro" ? 50 : 40, monthlyBonus: bonus, profTax: pt });
  await expect(page.locator("#results")).toBeVisible();
  await expectAmount(page.locator("#monthlyInHand"), s.inHand, { slack: 1, label: "in-hand" });
  await expectAmount(page.locator("#annualInHand"), s.inHand * 12, { slack: 12, label: "annual in-hand" });
  await expectAmount(page.locator("#resBasicPay"), s.basic, { label: "basic" });
  await expectAmount(page.locator("#resHRA"), s.hra, { label: "HRA" });
  await expectAmount(page.locator("#resSpecialAllowance"), s.special, { label: "special allowance" });
  await expectAmount(page.locator("#resBonus"), bonus, { label: "bonus" });
  await expectAmount(page.locator("#resGrossSalary"), s.gross, { label: "gross" });
  await expectAmount(page.locator("#resEmployeePF"), s.employeePf, { label: "employee PF" });
  await expectAmount(page.locator("#resProfTax"), pt, { label: "professional tax" });
  await expectAmount(page.locator("#resTDS"), s.monthlyTax, { slack: 0.6, label: "TDS" });
  await expectAmount(page.locator("#resTotalDeductions"), s.deductions, { slack: 1, label: "deductions" });
  await expectAmount(page.locator("#resEmployerPF"), s.employerPf, { label: "employer PF" });
  await expectAmount(page.locator("#resGratuity"), s.gratuity, { label: "gratuity" });
  if (s.employerEsi > 0) await expectAmount(page.locator("#resEmployerESI"), s.employerEsi, { label: "employer ESI" });
  else await expect(page.locator("#resEmployerESI")).toHaveText("N/A");
  return s;
}

test.describe("Salary calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/salary-calculator/");
  });

  test("opens with the page's worked example: 10 lakh CTC, metro, 40% basic", async ({ page }) => {
    await expect(page.locator("#annualCTC")).toHaveValue("10,00,000");
    const s = await expectResults(page, { ctc: 1000000 });
    await expect(page.locator("#monthlyInHand")).toHaveText("₹" + inr(s.inHand));
    await expectNoBadNumbers(page);
  });

  test("the worked example table matches the conventions", async ({ page }) => {
    const s = salary({ ctc: 1000000 });
    const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "How it is derived" }) });
    const rows = Object.fromEntries(await table.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [tr.cells[0].textContent.trim(), tr.cells[1].textContent.trim()])));
    const want = { "Monthly CTC": s.monthlyCtc, "Basic pay": s.basic, HRA: s.hra, "Employer PF": s.employerPf, "Gratuity accrual": s.gratuity,
      "Special allowance": s.special, "Gross salary": s.gross, "Employee PF": s.employeePf, "Professional tax": 200, "Income tax (TDS)": s.monthlyTax, "In-hand salary": s.inHand };
    for (const [line, value] of Object.entries(want)) {
      expect(rows[line], `row ${line}`).toBe("₹" + inr(value));
    }
  });

  const cases = [
    { ctc: 1000000, city: "nonmetro" },
    { ctc: 2500000 },
    { ctc: 2500000, city: "nonmetro", basic: 50, bonus: 10000, pt: 250 },
    { ctc: 5000000, basic: 35 },
    { ctc: 1600000, basic: 20, pt: 300 },
    { ctc: 240000, city: "nonmetro" },
    { ctc: 100000 },
  ];
  for (const x of cases) {
    test(`CTC ${inr(x.ctc)}, ${x.city || "metro"}, basic ${x.basic || 40}%, bonus ${x.bonus || 0}, PT ${x.pt ?? 200}`, async ({ page }) => {
      await fillAll(page, x);
      await expect(page.locator("#results")).toBeInViewport();
      await expectResults(page, x);
    });
  }

  test("the city choice moves money between HRA and special allowance, not in-hand pay", async ({ page }) => {
    await fillAll(page, { ctc: 1800000, city: "metro" });
    const metro = await page.locator("#monthlyInHand").textContent();
    await fillAll(page, { ctc: 1800000, city: "nonmetro" });
    await expectResults(page, { ctc: 1800000, city: "nonmetro" });
    await expect(page.locator("#monthlyInHand")).toHaveText(metro);
  });

  test("Indian grouping in CTC, bonus and professional tax", async ({ page }) => {
    for (const id of ["annualCTC", "monthlyBonus", "profTax"]) await expectIndianGrouping(page.locator("#" + id));
  });

  test("empty fields never show NaN", async ({ page }) => {
    for (const id of ["annualCTC", "basicPercent", "monthlyBonus", "profTax"]) await setField(page.locator("#" + id), "");
    await page.getByRole("button", { name: "Calculate In-Hand Salary" }).click();
    await expectNoBadNumbers(page);
  });

  test("Reset asks first and restores the defaults", async ({ page, dialogs }) => {
    await fillAll(page, { ctc: 3000000, city: "nonmetro", basic: 55, bonus: 4000, pt: 150 });
    await page.getByRole("button", { name: "Reset" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/reset/i);
    await expect(page.locator("#annualCTC")).toHaveValue("10,00,000");
    await expect(page.locator("#cityType")).toHaveValue("metro");
    await expect(page.locator("#basicPercent")).toHaveValue("40");
    await expect(page.locator("#profTax")).toHaveValue("200");
    await page.getByRole("button", { name: "Calculate In-Hand Salary" }).click();
    await expectResults(page, { ctc: 1000000 });
  });

  test("city and basic % are saved and come back after a reload", async ({ page }) => {
    await page.locator("#cityType").selectOption("nonmetro");
    await typeInto(page.locator("#basicPercent"), "45");
    await page.reload();
    await expect(page.locator("#cityType")).toHaveValue("nonmetro");
    await expect(page.locator("#basicPercent")).toHaveValue("45");
    await expectResults(page, { ctc: 1000000, city: "nonmetro", basic: 45 });
  });

  test("a typed CTC is saved and comes back after a reload", async ({ page }) => {
    // KNOWN BUG: auto-save loses Indian-formatted amounts (see home-loan.spec.mjs for the cause).
    test.fail();
    await typeInto(page.locator("#annualCTC"), "1500000");
    await page.locator("#basicPercent").click();
    await page.reload();
    await expect(page.locator("#annualCTC")).toHaveValue("15,00,000");
  });

  test("HRA at 50% covers all eight Rule 279 cities from tax year 2026-27", async ({ page }) => {
    // KNOWN BUG (given by the site owner): the 50% option names only Delhi, Mumbai, Kolkata and Chennai, and the
    // page text says "four metro cities". Income-tax Rules, 2026, rule 279 (in force 1 April 2026) gives 50% to
    // Mumbai, Kolkata, Delhi, Chennai, Hyderabad, Pune, Ahmedabad and Bengaluru. Someone in Hyderabad, Bengaluru,
    // Pune or Ahmedabad picks "Non-Metro" and gets HRA at 40% of basic instead of 50%.
    test.fail();
    const options = await page.locator("#cityType option").evaluateAll((os) => os.map((o) => ({ value: o.value, text: o.textContent })));
    for (const city of RULE_279_CITIES) {
      const option = options.find((o) => o.text.includes(city));
      expect(option, `an option names ${city}`).toBeTruthy();
      await page.locator("#cityType").selectOption(option.value);
      await page.getByRole("button", { name: "Calculate In-Hand Salary" }).click();
      const s = salary({ ctc: 1000000, hraPct: 50 });
      await expectAmount(page.locator("#resHRA"), s.hra, { label: `HRA for ${city}` });
    }
  });

  test("professional tax can be set to zero", async ({ page }) => {
    // KNOWN BUG: the page reads the field with `|| 200`, so 0 becomes ₹200. States such as Delhi, Haryana,
    // Uttar Pradesh and Rajasthan levy no professional tax, so their in-hand pay is understated by ₹200 a month.
    test.fail();
    await fillAll(page, { ctc: 1000000, pt: 0 });
    await expectResults(page, { ctc: 1000000, pt: 0 });
  });

  test("an ESI-covered salary deducts the employee's 0.75%", async ({ page }) => {
    // KNOWN BUG: at a monthly CTC of 21,000 or less the page adds employer ESI (3.25%) but never deducts the
    // employee's 0.75% share (ESIC rates from 1 July 2019), although its own text says "the employee pays 0.75%".
    // In-hand pay is overstated by 0.75% of gross.
    test.fail();
    await fillAll(page, { ctc: 240000, city: "nonmetro" });
    const s = salary({ ctc: 240000, hraPct: 40, employeeEsi: true });
    await expectAmount(page.locator("#monthlyInHand"), s.inHand, { slack: 1 });
  });

  test("the salary parts never add up to more than the CTC", async ({ page }) => {
    // KNOWN BUG (small): at 60% basic in a metro, basic + HRA + employer PF + gratuity is 100.09% of CTC. Special
    // allowance is floored at 0 instead of the excess being taken back, so the employer cost shown is more than
    // the CTC entered (₹72 a month more on a 10 lakh CTC).
    test.fail();
    await fillAll(page, { ctc: 1000000, basic: 60 });
    const read = async (id) => Number((await page.locator("#" + id).textContent()).replace(/[^\d.]/g, ""));
    const cost = (await read("resGrossSalary")) + (await read("resEmployerPF")) + (await read("resGratuity"));
    expect(cost).toBeLessThanOrEqual(Math.round(1000000 / 12) + 1);
  });

  test("Share sends the in-hand pay on WhatsApp", async ({ page }) => {
    const shown = (await page.locator("#monthlyInHand").innerText()).trim();
    await expectWhatsAppShare(page, /share/i, ["In-Hand Salary", shown]);
  });
});
