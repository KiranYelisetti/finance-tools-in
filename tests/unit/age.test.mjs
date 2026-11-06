// Unit tests for src/js/calc/age.js. The page runs in the visitor's time zone, so these tests pin India time.
process.env.TZ = "Asia/Kolkata";

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { load, knownBug } from "./_helpers.mjs";
import { age, daysToNextBirthday, generation } from "../lib/reference.mjs";

const Age = load("age");
const pick = (a) => ({ years: a.years, months: a.months, days: a.days });

test("born 15 May 1990, on 6 Nov 2026: 36 years 5 months 22 days", () => {
  // 15 May 1990 + 36 years 5 months = 15 Oct 2026, and 15 Oct to 6 Nov is 22 days.
  const a = Age.calculate("1990-05-15", "2026-11-06");
  assert.deepEqual(pick(a), { years: 36, months: 5, days: 22 });
  assert.equal(a.text, "36 years, 5 months, 22 days");
  assert.equal(a.totalMonths, 36 * 12 + 5);
  assert.equal(a.totalDays, age("1990-05-15", "2026-11-06").totalDays);
  assert.equal(a.totalWeeks, Math.floor(a.totalDays / 7));
  assert.equal(a.totalHours, a.totalDays * 24);
  assert.equal(a.totalMinutes, a.totalDays * 1440);
  assert.equal(a.generation, "Millennial (Gen Y)");
});

test("agrees with the anniversary count for many dates (either month-end convention)", () => {
  const births = ["1946-01-01", "1964-08-20", "1985-11-06", "1985-11-07", "1997-06-30", "2000-01-31", "2000-02-29", "2012-12-31", "2024-02-29"];
  const ons = ["2026-11-06", "2026-02-28", "2026-03-01", "2028-02-29", "2030-12-31", "2027-01-01"];
  for (const b of births) {
    for (const on of ons) {
      if (b > on) continue;
      const a = Age.calculate(b, on);
      const ref = age(b, on);
      assert.ok([ref.clamp, ref.roll].some((r) => r.years === a.years && r.months === a.months && r.days === a.days), `${b} on ${on}: got ${JSON.stringify(pick(a))}`);
      assert.equal(a.totalDays, ref.totalDays, `${b} on ${on}: total days`);
    }
  }
});

test("leap years: born 29 Feb 2000", () => {
  // Feb 29 birthdays fall on 1 Mar in other years here (the "roll" convention)
  assert.deepEqual(pick(Age.calculate("2000-02-29", "2026-02-28")), { years: 25, months: 11, days: 30 });
  assert.deepEqual(pick(Age.calculate("2000-02-29", "2026-03-01")), { years: 26, months: 0, days: 0 });
  assert.deepEqual(pick(Age.calculate("2000-02-29", "2028-02-29")), { years: 28, months: 0, days: 0 });
});

test("leap-year day counts", () => {
  assert.equal(Age.calculate("2024-02-28", "2024-03-01").totalDays, 2);
  assert.equal(Age.calculate("2023-02-28", "2023-03-01").totalDays, 1);
  assert.equal(Age.calculate("1900-01-01", "2000-01-01").totalDays, 36524); // 1900 is not a leap year, 24 leap days
  assert.equal(Age.calculate("2000-01-01", "2100-01-01").totalDays, 36525); // 2000 is, 25 leap days
});

test("born on the 'as on' date: all zero, no words", () => {
  const a = Age.calculate("2026-11-06", "2026-11-06");
  assert.deepEqual(pick(a), { years: 0, months: 0, days: 0 });
  assert.equal(a.totalDays, 0);
  assert.equal(a.text, "");
});

test("missing and future dates are errors", () => {
  assert.deepEqual(Age.calculate("", "2026-11-06"), { error: "missing" });
  assert.deepEqual(Age.calculate("2000-01-01", ""), { error: "missing" });
  assert.deepEqual(Age.calculate("2027-01-01", "2026-11-06"), { error: "future" });
});

test("generations at every boundary year", () => {
  for (const year of [1945, 1946, 1964, 1965, 1980, 1981, 1996, 1997, 2012, 2013]) {
    assert.ok(Age.generation(year).startsWith(generation(year)), `${year}: ${Age.generation(year)}`);
  }
});

test("age text: singular and plural, zero parts left out", () => {
  assert.equal(Age.ageText(1, 1, 1), "1 year, 1 month, 1 day");
  assert.equal(Age.ageText(2, 0, 3), "2 years, 3 days");
  assert.equal(Age.ageText(0, 0, 0), "");
});

test("next round milestone: 10,000 days, then 20,000, then 30,000", () => {
  assert.equal(Age.calculate("2000-01-01", "2026-11-06").milestoneDays, 10000); // 9,806 days old
  assert.equal(Age.calculate("1990-01-01", "2026-11-06").milestoneDays, 20000);
  assert.equal(Age.calculate("1960-01-01", "2026-11-06").milestoneDays, 30000);
  const a = Age.calculate("2000-01-01", "2026-11-06");
  assert.equal(a.milestoneDate.toISOString().slice(0, 10), "2027-05-19"); // 1 Jan 2000 + 10,000 days
});

// Fixed 2026-11-06, kept as a regression test (was a known bug: 31 Jan to 1 Mar 2026 gives 1 month -2 days)
test("days are never negative at a month end", () => {
  const a = Age.calculate("2026-01-31", "2026-03-01");
  const ref = age("2026-01-31", "2026-03-01");
  assert.ok([ref.clamp, ref.roll].some((r) => r.months === a.months && r.days === a.days));
});

// Fixed 2026-11-06, kept as a regression test (was a known bug: UTC dates against a local-midnight birthday: always one day short)
test("days to the next birthday in India time", () => {
  assert.equal(Age.calculate("2000-12-25", "2026-11-06").daysUntilBirthday, daysToNextBirthday("2000-12-25", "2026-11-06"));
});

// Fixed 2026-11-06, kept as a regression test (was a known bug: stops at 30,000 days)
test("the next milestone is never in the past", () => {
  assert.equal(Age.calculate("1940-01-01", "2026-11-06").milestoneDays, 40000);
});

// Fixed 2026-11-06, kept as a regression test (was a known bug: dates parsed as UTC are the previous evening in New York)
test("age is the same in a US time zone", () => {
  const modulePath = fileURLToPath(new URL("../../src/js/calc/age.js", import.meta.url));
  const out = spawnSync(process.execPath, ["-e", `const a=require(${JSON.stringify(modulePath)}).calculate("2000-03-01","2026-11-06");process.stdout.write(JSON.stringify([a.years,a.months,a.days]))`], {
    env: { ...process.env, TZ: "America/New_York" },
    encoding: "utf8",
  });
  assert.deepEqual(JSON.parse(out.stdout), [26, 8, 5]);
});

test("on the birthday itself there are 0 days to the next one, and a 29 Feb birthday falls on 1 Mar", () => {
  assert.equal(Age.calculate("2000-11-06", "2026-11-06").daysUntilBirthday, 0);
  const leap = Age.calculate("2000-02-29", "2026-02-28");
  assert.equal(leap.daysUntilBirthday, 1);
  assert.equal(leap.nextBirthday.toISOString().slice(0, 10), "2026-03-01");
  assert.equal(Age.calculate("2000-02-29", "2028-02-01").nextBirthday.toISOString().slice(0, 10), "2028-02-29");
});

test("today is the visitor's local date, not the UTC one", () => {
  // 1:00 am on 7 Nov in India is still 6 Nov in UTC
  assert.equal(Age.todayLocal(new Date(2026, 10, 7, 1, 0)), "2026-11-07");
  assert.equal(Age.todayLocal(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("days are never negative for any birth and 'as on' date pair", () => {
  const start = Date.UTC(1999, 11, 1);
  for (let i = 0; i < 1200; i += 7) {
    const b = new Date(start + i * 86400000).toISOString().slice(0, 10);
    for (const on of ["2026-02-28", "2026-03-01", "2026-03-02", "2026-04-30", "2028-02-29"]) {
      const a = Age.calculate(b, on);
      const ref = age(b, on).roll;
      assert.deepEqual(pick(a), ref, `${b} on ${on}`);
    }
  }
});
