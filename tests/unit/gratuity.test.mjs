// Unit tests for src/js/calc/gratuity.js. Expected figures are worked by hand from the Code on Social Security, 2020
// (sections 2(88), 53, 54), the Payment of Gratuity Act, 1972 and the Income-tax Act, 2025, section 19(1) Table.
// Sources: revenue-hq/research/tax_law_2026/gratuity_rules_2026-11-06.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, close } from "./_helpers.mjs";

const G = load("gratuity");

test("service counts the last working day, and only a part year of MORE than six months rounds up", () => {
  assert.deepEqual(G.service("2021-01-01", "2025-12-31"), { years: 5, months: 0, days: 0, counted: 5 });
  // 1 Apr 2019 to 15 Jan 2026: 6 years 9 months 15 days, so 7 years count
  assert.deepEqual(G.service("2019-04-01", "2026-01-15"), { years: 6, months: 9, days: 15, counted: 7 });
  // Exactly six months over does not round up, one day more does
  assert.equal(G.service("2020-01-01", "2025-06-30").counted, 5);
  assert.equal(G.service("2020-01-01", "2025-07-01").counted, 6);
  assert.equal(G.service("2026-01-10", "2026-01-01"), null);
});

test("the leaving date decides the law: the Code from 21 Nov 2025", () => {
  assert.equal(G.lawFor("2025-11-20"), "act1972");
  assert.equal(G.lawFor("2025-11-21"), "code");
  assert.equal(G.lawFor("2026-06-30"), "code");
});

test("Code wages: basic + DA, raised to half of total pay when other pay is more than half (section 2(88))", () => {
  assert.equal(G.wages(30000, 20000, "code"), 30000); // other pay is 40% of the total, nothing added
  assert.equal(G.wages(20000, 40000, "code"), 30000); // other pay 40,000 of 60,000: 10,000 over half is added back
  assert.equal(G.wages(25000, 25000, "code"), 25000); // exactly half: nothing added
  assert.equal(G.wages(20000, 40000, "act1972"), 20000); // the old Act used basic + DA only
});

test("a worked case under the Code: 8 years, big allowances, part of it taxable", () => {
  // 1 Jun 2018 to 31 Oct 2026 = 8 years 5 months, so 8 years. Basic + DA 40,000, other pay 60,000.
  const r = G.calculate({ joinDate: "2018-06-01", lastDay: "2026-10-31", basicDA: 40000, otherPay: 60000, type: "permanent", reason: "resignation" });
  assert.equal(r.law, "code");
  assert.equal(r.service.counted, 8);
  assert.equal(r.monthlyWage, 50000); // half of 1,00,000
  assert.equal(r.addedByHalfRule, 10000);
  close(r.payable, (50000 * 15) / 26 * 8, 1e-6); // 2,30,769.23
  close(r.oldRuleFormula, (40000 * 15) / 26 * 8, 1e-6); // 1,84,615.38
  // Tax-free part uses basic + DA (CBDT definition of salary), so the 50% add-back is taxable
  close(r.taxFree, 184615.3846, 1e-3);
  close(r.taxable, 46153.8462, 1e-3);
});

test("the Rs 20 lakh ceiling, and Rs 25 lakh for central government employees", () => {
  const base = { joinDate: "2010-01-01", lastDay: "2019-12-31", basicDA: 400000, otherPay: 0, reason: "retirement" };
  const p = G.calculate({ ...base, type: "permanent" });
  close(p.formula, (400000 * 15) / 26 * 10, 1e-6); // 23,07,692.31
  assert.equal(p.payable, 2000000);
  assert.equal(p.capped, true);
  assert.equal(p.law, "act1972");
  const g = G.calculate({ ...base, type: "government" });
  close(g.payable, (400000 * 15) / 26 * 10, 1e-6); // under the Rs 25 lakh CCS ceiling
  assert.equal(g.capped, false);
  close(g.taxFree, g.payable, 1e-6); // fully exempt for government employees
  assert.equal(g.taxable, 0);
});

test("eligibility: five years, three for journalists, none on death or disablement", () => {
  const pay = { basicDA: 30000, otherPay: 10000 };
  assert.equal(G.calculate({ ...pay, joinDate: "2021-01-01", lastDay: "2025-11-30", type: "permanent", reason: "resignation" }).eligible, false); // 4 years 11 months
  assert.equal(G.calculate({ ...pay, joinDate: "2021-01-01", lastDay: "2025-11-30", type: "permanent", reason: "resignation" }).payable, 0);
  assert.equal(G.calculate({ ...pay, joinDate: "2022-12-01", lastDay: "2025-11-30", type: "journalist", reason: "resignation" }).eligible, true); // 3 years
  const death = G.calculate({ ...pay, joinDate: "2024-01-01", lastDay: "2025-12-31", type: "permanent", reason: "death" });
  assert.equal(death.eligible, true);
  assert.equal(death.service.counted, 2);
  close(death.payable, (30000 * 15) / 26 * 2, 1e-6);
});

test("fixed-term employees: one year under the Code, part over six months rounds up (rule 33)", () => {
  const pay = { basicDA: 26000, otherPay: 0, type: "fixedTerm", reason: "contractEnd" };
  const a = G.calculate({ ...pay, joinDate: "2025-01-01", lastDay: "2026-04-30" }); // 1 year 4 months
  assert.equal(a.eligible, true);
  assert.equal(a.service.counted, 1);
  close(a.payable, 15000, 1e-9); // 26,000 / 26 x 15 x 1
  const b = G.calculate({ ...pay, joinDate: "2025-01-01", lastDay: "2026-07-31" }); // 1 year 7 months
  assert.equal(b.service.counted, 2);
  close(b.payable, 30000, 1e-9);
  const c = G.calculate({ ...pay, joinDate: "2025-03-01", lastDay: "2025-12-31" }); // 10 months: not yet one year
  assert.equal(c.eligible, false);
  // Before 21 Nov 2025 the old Act applied: five years for everyone
  assert.equal(G.calculate({ ...pay, joinDate: "2023-01-01", lastDay: "2025-06-30" }).eligible, false);
});

test("missing or impossible input gives null", () => {
  assert.equal(G.calculate({ joinDate: "", lastDay: "2026-01-01", basicDA: 30000 }), null);
  assert.equal(G.calculate({ joinDate: "2020-01-01", lastDay: "2026-01-01", basicDA: 0 }), null);
  assert.equal(G.calculate({ joinDate: "2026-02-01", lastDay: "2026-01-01", basicDA: 30000 }), null);
});
