// Independent reference maths for the tests.
//
// Every function here is written from the published formula or the law, not copied from the page scripts or from
// src/js/calc, so a test compares the site against an outside source. Where a calculator states its own convention
// (SIP instalments at the start of each month, PPF deposits credited for the whole year, and so on) the function
// follows that stated convention, and the comment says so. Each block cites where its rule comes from.

const DAY_MS = 86_400_000;

// ───────────────────────── Loans ─────────────────────────

/**
 * EMI of a reducing-balance loan. The EMI is the level monthly payment whose present value at the monthly rate r
 * equals the principal (present value of an ordinary annuity): P = EMI x (1 - (1 + r)^-n) / r,
 * so EMI = P x r / (1 - (1 + r)^-n), with r = annual % / 12 / 100. At 0% the EMI is simply P / n.
 * This is the standard amortising-loan formula every Indian lender quotes.
 */
export function emi(principal, annualPct, months) {
  const r = annualPct / 12 / 100;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/**
 * Month-by-month amortisation of a loan with a fixed EMI.
 * Each month: interest = balance x r, then the payment (EMI plus any monthly extra, never more than balance plus
 * interest) clears the interest first and the rest reduces the balance. Optional prepayments:
 *  - lumpAtStart: paid before the first EMI (EMI Prepayment calculator: "a bonus you can pay immediately")
 *  - yearly: { amount, fromYear } paid after the EMI at the end of every 12th month from loan year `fromYear`
 *    (Home Loan calculator: "a prepayment ... at the end of every year from year 3").
 * Stops when the balance is cleared or after maxMonths payments.
 */
export function amortise({ principal, annualPct, emi: payment, maxMonths, extraMonthly = 0, lumpAtStart = 0, yearly = null }) {
  const r = annualPct / 12 / 100;
  let balance = principal;
  let paid = 0;
  let interest = 0;
  let months = 0;
  if (lumpAtStart > 0) {
    const lump = Math.min(lumpAtStart, balance);
    balance -= lump;
    paid += lump;
  }
  const yearOne = { interest: 0, principal: 0 };
  while (balance > 1e-6 && months < maxMonths) {
    months += 1;
    const i = balance * r;
    const due = balance + i;
    const pay = Math.min(payment + extraMonthly, due);
    interest += i;
    paid += pay;
    balance = due - pay;
    if (months <= 12) {
      yearOne.interest += i;
      yearOne.principal += pay - i;
    }
    if (yearly && yearly.amount > 0 && months % 12 === 0 && months >= yearly.fromYear * 12 && balance > 0) {
      const pre = Math.min(yearly.amount, balance);
      balance -= pre;
      paid += pre;
    }
  }
  return { months, interest, paid, balance, yearOne };
}

// ───────────────────────── Savings ─────────────────────────

/**
 * Future value of a monthly SIP when each instalment is invested at the START of its month and the annual rate is
 * split into twelve equal monthly rates (i = annual % / 12 / 100). This is the convention the SIP page states
 * ("instalment at the start of each month", "12% a year becomes 1% a month"). Summed instalment by instalment:
 * the instalment paid k months before the end grows for k months.
 */
export function sipFutureValue(monthly, annualPct, years) {
  const i = annualPct / 12 / 100;
  const n = Math.round(years * 12);
  let fv = 0;
  for (let k = 1; k <= n; k++) fv += monthly * Math.pow(1 + i, k);
  return fv;
}

/**
 * Monthly saving needed to reach `target` after `months` months when each saving is made at the END of the month
 * and earns a monthly rate equivalent to `annualPct` a year compounded yearly (i = (1 + a)^(1/12) - 1).
 * This is the convention the Study Abroad and Wedding pages use for their "monthly SIP" line. They only say
 * "assuming 12% annual returns", so the compounding is not disclosed (see tests/README.md).
 * Summed: the saving made k months before the end grows for k - 1 months.
 */
export function sipNeededForGoal(target, annualPct, months) {
  const i = Math.pow(1 + annualPct / 100, 1 / 12) - 1;
  let growthOfOnePerMonth = 0;
  for (let k = 1; k <= months; k++) growthOfOnePerMonth += Math.pow(1 + i, k - 1);
  return target / growthOfOnePerMonth;
}

/**
 * Public Provident Fund balance at the end of each year (index 1..years).
 * PPF Scheme, 2019 (rules at nsiindia.gov.in): interest is worked out on the lowest balance between the 5th and the
 * end of each month and credited at the end of the financial year, so it compounds yearly. A deposit made by
 * 5 April earns interest for the whole year. The PPF calculator assumes exactly that (the best case), without
 * saying so: B(y) = (B(y-1) + deposit) x (1 + rate).
 */
export function ppfBalances(deposit, annualPct, years) {
  const out = [0];
  let b = 0;
  for (let y = 1; y <= years; y++) {
    b = (b + deposit) * (1 + annualPct / 100);
    out.push(b);
  }
  return out;
}

/**
 * Largest PPF partial withdrawal in financial year `year` (year 1 = the year the account was opened).
 * PPF Scheme, 2019, paragraph 9(1): one withdrawal a year after five years from the end of the year of opening
 * (so from year 7), of up to 50% of the balance at the end of the fourth year before the year of withdrawal or at
 * the end of the preceding year, whichever is lower.
 */
export function ppfWithdrawalLimit(balances, year) {
  if (year < 7) return 0;
  return 0.5 * Math.min(balances[year - 4], balances[year - 1]);
}

/**
 * Sukanya Samriddhi Account balance at the end of each year (index 1..21).
 * SSA Scheme, 2019 (rules at nsiindia.gov.in): deposits for 15 years from opening, maturity 21 years from opening,
 * interest credited yearly on the same lowest-balance rule as PPF. Same deposit-by-5-April assumption as above.
 */
export function ssyBalances(deposit, annualPct) {
  const out = [0];
  let b = 0;
  for (let y = 1; y <= 21; y++) {
    if (y <= 15) b += deposit;
    b *= 1 + annualPct / 100;
    out.push(b);
  }
  return out;
}

/**
 * SSY partial withdrawal for education: up to 50% of the balance at the end of the financial year before the
 * application, once the girl has turned 18 (SSA Scheme, 2019). For a girl aged `ageAtOpening` in year 1, she is 18
 * at the end of year 18 - ageAtOpening.
 */
export function ssyWithdrawalAt18(balances, ageAtOpening) {
  return 0.5 * balances[18 - ageAtOpening];
}

/** Value after `years` of growth at `pct` a year, compounded yearly. */
export function grow(amount, pct, years) {
  return amount * Math.pow(1 + pct / 100, years);
}

// ───────────────────────── GST ─────────────────────────

/**
 * GST on a supply.
 *  - Tax-exclusive value: tax = value x rate / 100.
 *  - Tax-inclusive amount: the tax inside it is amount x rate / (100 + rate), the usual "tax fraction".
 *  - Within a state the tax is split equally between CGST and SGST (CGST Act, 2017, s.9(1) and the matching SGST Act,
 *    each at half the notified rate). Between states the whole tax is IGST (IGST Act, 2017, s.5(1)).
 */
export function gst(amount, ratePct, mode = "add") {
  let base, tax, total;
  if (mode === "add") {
    base = amount;
    tax = (amount * ratePct) / 100;
    total = amount + tax;
  } else {
    total = amount;
    tax = (amount * ratePct) / (100 + ratePct);
    base = amount - tax;
  }
  return { base, tax, total, cgst: tax / 2, sgst: tax / 2, igst: tax };
}

// ───────────────────────── Income tax, tax year 2026-27 ─────────────────────────
// Sources (read from the Gazette text, see revenue-hq/research/tax_law_2026/income_tax_act_2025_map_2026-11-06.md):
//  - New regime slabs: Income-tax Act, 2025, s.202(1). Same bands as FY 2025-26 (Finance Act 2025).
//  - Old regime slabs (below 60): Finance Act, 2026, First Schedule, Part I-B, Paragraph A.
//  - Rebate: s.156(1) old regime, up to 12,500 when total income <= 5,00,000.
//            s.156(2) new regime, up to 60,000 when income <= 12,00,000, with marginal relief above.
//  - Standard deduction: s.19(1) Table Sl. No. 2: 75,000 (new) or 50,000 (old), never more than the salary.
//  - Health and Education Cess 4% of tax plus surcharge: Finance Act, 2026, s.3(15).
//  - Surcharge: 10% above 50 lakh, 15% above 1 crore, 25% above 2 crore, 37% above 5 crore (old regime only,
//    the new regime stops at 25%), with marginal relief at each step (Finance Act, 2026, s.3(4)(b), s.3(5),
//    First Schedule Part I-B Paragraph F).

const NEW_SLABS = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
const OLD_SLABS = [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]];

function slabTax(income, slabs) {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of slabs) {
    if (income > lower) tax += (Math.min(income, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

export const newSlabTax = (income) => slabTax(Math.max(0, income), NEW_SLABS);
export const oldSlabTax = (income) => slabTax(Math.max(0, income), OLD_SLABS);

/** Tax after the s.156 rebate. */
export function afterRebate(income, regime) {
  if (regime === "new") {
    const t = newSlabTax(income);
    if (income <= 1200000) return Math.max(0, t - Math.min(t, 60000));
    return Math.min(t, income - 1200000); // marginal relief: tax cannot exceed the income above 12 lakh
  }
  const t = oldSlabTax(income);
  if (income <= 500000) return Math.max(0, t - Math.min(t, 12500));
  return t;
}

function surchargeRate(income, regime) {
  if (income > 50000000) return regime === "old" ? 0.37 : 0.25;
  if (income > 20000000) return 0.25;
  if (income > 10000000) return 0.15;
  if (income > 5000000) return 0.10;
  return 0;
}

/** Surcharge with marginal relief: tax plus surcharge above a threshold may exceed the tax plus surcharge at the
 *  threshold by no more than the income above it. */
export function surcharge(income, regime) {
  const tax = afterRebate(income, regime);
  const rate = surchargeRate(income, regime);
  if (!rate) return 0;
  const steps = [5000000, 10000000, 20000000, 50000000].filter((t) => income > t);
  const threshold = steps[steps.length - 1];
  const atThreshold = afterRebate(threshold, regime) * (1 + surchargeRate(threshold, regime));
  const capped = Math.min(tax * (1 + rate), atThreshold + (income - threshold));
  return capped - tax;
}

/**
 * Full computation for a resident individual below 60 with salary and other income at slab rates.
 * withSurcharge=false gives the figure the Income Tax page shows (it states it leaves surcharge out).
 */
export function incomeTax({ salary = 0, otherIncome = 0, oldDeductions = 0 }, regime, { withSurcharge = false } = {}) {
  const std = Math.min(regime === "new" ? 75000 : 50000, salary);
  const gross = salary + otherIncome;
  const taxable = Math.max(0, gross - std - (regime === "old" ? oldDeductions : 0));
  const slab = regime === "new" ? newSlabTax(taxable) : oldSlabTax(taxable);
  const tax = afterRebate(taxable, regime);
  const sur = withSurcharge ? surcharge(taxable, regime) : 0;
  const cess = (tax + sur) * 0.04;
  return { std, gross, taxable, slab, rebate: slab - tax, tax, surcharge: sur, cess, total: tax + sur + cess };
}

// ───────────────────────── Salary ─────────────────────────

/**
 * In-hand salary, following the conventions the Salary page states ("What this calculator does, step by step"):
 * basic = basic% of CTC, HRA = 50% of basic in the 50% cities and 40% elsewhere, employer PF 12% of basic,
 * gratuity accrual 4.81% of basic (15/26 of a month's basic per year under the Payment of Gratuity Act, 1972,
 * s.4(2), is 4.8077%, which the page rounds to 4.81%), employer ESI 3.25% when monthly CTC is 21,000 or less,
 * special allowance = what is left of monthly CTC. Deductions: employee PF 12% of basic, professional tax as entered,
 * income tax under the new regime on annual gross (see incomeTax above), spread over twelve months.
 * employeeEsi=true also deducts the employee's 0.75% ESI share (ESIC rates from 1 July 2019: employee 0.75%,
 * employer 3.25% of wages, for wages up to 21,000 a month).
 */
export function salary({ ctc, basicPct = 40, hraPct = 50, monthlyBonus = 0, profTax = 200, employeeEsi = false }) {
  const monthlyCtc = ctc / 12;
  const basic = (ctc * basicPct) / 100 / 12;
  const hra = (basic * hraPct) / 100;
  const employerPf = basic * 0.12;
  const gratuity = basic * 0.0481;
  const esiCovered = monthlyCtc <= 21000;
  const employerEsi = esiCovered ? monthlyCtc * 0.0325 : 0;
  const special = monthlyCtc - basic - hra - employerPf - gratuity - employerEsi;
  const gross = basic + hra + special + monthlyBonus;
  const annualTax = incomeTax({ salary: gross * 12 }, "new").total;
  const employeePf = basic * 0.12;
  const esiEmployee = employeeEsi && esiCovered ? gross * 0.0075 : 0;
  const deductions = employeePf + profTax + annualTax / 12 + esiEmployee;
  return {
    monthlyCtc, basic, hra, employerPf, gratuity, employerEsi, special, gross, annualTax,
    monthlyTax: annualTax / 12, employeePf, esiEmployee, deductions, inHand: gross - deductions,
  };
}

// ───────────────────────── Age ─────────────────────────

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12

/** Parse "YYYY-MM-DD" into plain numbers, no time zone involved. */
export function ymd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

const toDayNumber = ({ y, m, d }) => Date.UTC(y, m - 1, d) / DAY_MS;

/** The same day k months later. A day that does not exist in the target month either clamps to the month's last
 *  day ("clamp", 31 Jan + 1 month = 28 Feb) or rolls into the next month ("roll", 31 Jan + 1 month = 3 Mar).
 *  Both are in use. Feb 29 birthdays fall on 28 Feb (clamp) or 1 Mar (roll) in other years. */
function addMonths({ y, m, d }, k, mode) {
  const total = y * 12 + (m - 1) + k;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dim = daysInMonth(ny, nm);
  if (d <= dim) return { y: ny, m: nm, d };
  if (mode === "clamp") return { y: ny, m: nm, d: dim };
  const rolled = new Date(Date.UTC(ny, nm - 1, d));
  return { y: rolled.getUTCFullYear(), m: rolled.getUTCMonth() + 1, d: rolled.getUTCDate() };
}

/**
 * Age in completed years, months and days by counting anniversaries: the most whole years, then the most whole
 * months, that fit between the two dates, then the days left over. Returns the answer for both month-end
 * conventions; for most dates they agree.
 */
export function age(birthStr, onStr) {
  const b = ymd(birthStr);
  const on = ymd(onStr);
  const onDay = toDayNumber(on);
  const result = {};
  for (const mode of ["clamp", "roll"]) {
    let months = 0;
    while (toDayNumber(addMonths(b, months + 1, mode)) <= onDay) months += 1;
    const anchor = addMonths(b, months, mode);
    result[mode] = { years: Math.floor(months / 12), months: months % 12, days: onDay - toDayNumber(anchor) };
  }
  const totalDays = onDay - toDayNumber(b);
  return { ...result, totalDays, totalWeeks: Math.floor(totalDays / 7) };
}

/** Days from `onStr` to the next birthday on or after it (0 if it is the birthday). Uses the given leap-day mode. */
export function daysToNextBirthday(birthStr, onStr, mode = "roll") {
  const b = ymd(birthStr);
  const on = ymd(onStr);
  for (let k = 0; k < 3000; k++) {
    const candidate = addMonths(b, k * 12, mode);
    if (toDayNumber(candidate) >= toDayNumber(on)) return toDayNumber(candidate) - toDayNumber(on);
  }
  throw new Error("no birthday found");
}

/** Generation names by birth year (Pew Research Center: Silent 1928-45, Boomers 1946-64, Gen X 1965-80,
 *  Millennials 1981-96, Gen Z 1997-2012. Gen Alpha from 2013, McCrindle Research). */
export function generation(year) {
  if (year >= 2013) return "Gen Alpha";
  if (year >= 1997) return "Gen Z";
  if (year >= 1981) return "Millennial";
  if (year >= 1965) return "Gen X";
  if (year >= 1946) return "Baby Boomer";
  return "Silent Generation";
}

/** Date `days` days after "YYYY-MM-DD", as "YYYY-MM-DD". */
export function addDays(s, days) {
  return new Date(Date.UTC(...(({ y, m, d }) => [y, m - 1, d])(ymd(s))) + days * DAY_MS).toISOString().slice(0, 10);
}

// ───────────────────────── Cash ─────────────────────────

/** Rupee value of each note and coin the cash counter lists (RBI: notes in circulation, coins of 1, 2, 5, 10, 20). */
export const DENOMINATIONS = {
  note2000: 2000, note500: 500, note200: 200, note100: 100, note50: 50, note20: 20, note10: 10,
  coin20: 20, coin10: 10, coin5: 5, coin2: 2, coin1: 1,
};

// ───────────────────────── Number formatting helpers for expectations ─────────────────────────

/** Indian digit grouping of a whole number given as a string or BigInt: 2400000 -> "24,00,000". */
export function groupIndian(value) {
  const s = String(value);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return parts.join(",") + "," + last3;
}

/** Western digit grouping: 1500000 -> "1,500,000". */
export function groupWestern(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
