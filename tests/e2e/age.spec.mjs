// Age Calculator (/age-calculator/).
// Expected ages come from reference.age, which counts whole years, then whole months, then days, by anniversaries.
// At month ends and for 29 February there are two accepted conventions (clamp to the month's last day, or roll
// into the next month), so those tests accept either. The browser runs in India time (Asia/Kolkata) with the
// clock fixed at 6 Nov 2026, 10:00 IST, unless a test says otherwise.
import { test, expect, expectNoBadNumbers, expectWhatsAppShare, inr } from "./fixtures.mjs";
import { age, daysToNextBirthday, generation, addDays } from "../lib/reference.mjs";

const TODAY = "2026-11-06";
const NOW = new Date("2026-11-06T10:00:00+05:30");

const plural = (k, w) => `${k} ${w}${k > 1 ? "s" : ""}`;
const inWords = ({ years, months, days }) =>
  [years && plural(years, "year"), months && plural(months, "month"), days && plural(days, "day")].filter(Boolean).join(", ");

async function calc(page, birth, on = null) {
  await page.locator("#birthDate").fill(birth);
  if (on) await page.locator("#currentDate").fill(on);
  await page.getByRole("button", { name: "Calculate Age" }).click();
  await expect(page.locator("#results")).toBeVisible();
}

async function shown(page) {
  const n = async (id) => Number((await page.locator("#" + id).textContent()).replace(/,/g, ""));
  return { years: await n("years"), months: await n("months"), days: await n("days") };
}

async function expectAge(page, birth, on) {
  const a = age(birth, on);
  const got = await shown(page);
  expect([a.clamp, a.roll], `age from ${birth} to ${on}`).toContainEqual(got);
  await expect(page.locator("#ageInWords")).toHaveText(inWords(got));
  await expect(page.locator("#totalDays")).toHaveText(inr(a.totalDays));
  await expect(page.locator("#totalWeeks")).toHaveText(inr(a.totalWeeks));
  await expect(page.locator("#totalMonths")).toHaveText(inr(got.years * 12 + got.months));
  await expect(page.locator("#totalHours")).toHaveText(inr(a.totalDays * 24));
  await expect(page.locator("#totalMinutes")).toHaveText(inr(a.totalDays * 24 * 60));
  const birthYear = Number(birth.slice(0, 4));
  await expect(page.locator("#generation")).toContainText(generation(birthYear));
  return a;
}

test.describe("Age Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await page.goto("/age-calculator/");
  });

  test("the 'as on' date starts at today", async ({ page }) => {
    await expect(page.locator("#currentDate")).toHaveValue(TODAY);
    await expect(page.locator("#results")).toBeHidden();
    await expect(page.locator("#placeholder")).toBeVisible();
  });

  const births = ["1990-05-15", "1985-11-06", "1985-11-07", "2000-01-31", "1946-01-01", "1945-12-31", "1997-06-30", "2013-01-01", "2012-12-31", "1981-01-01", "1980-12-31", "1965-03-10", "1964-08-20", "2026-11-05"];
  for (const birth of births) {
    test(`born ${birth}, age today`, async ({ page }) => {
      await calc(page, birth);
      await expectAge(page, birth, TODAY);
      await expectNoBadNumbers(page);
    });
  }

  test("age on another date: every field", async ({ page }) => {
    await calc(page, "1992-08-17", "2030-02-03");
    await expectAge(page, "1992-08-17", "2030-02-03");
  });

  test("leap years: born 29 Feb 2000", async ({ page }) => {
    for (const on of ["2026-02-28", "2026-03-01", "2028-02-29", "2027-02-28", "2000-03-29"]) {
      await calc(page, "2000-02-29", on);
      await expectAge(page, "2000-02-29", on);
    }
  });

  test("leap-year day counts: Feb 2024 has 29 days, Feb 2023 has 28", async ({ page }) => {
    await calc(page, "2024-02-28", "2024-03-01");
    await expect(page.locator("#totalDays")).toHaveText("2");
    await calc(page, "2023-02-28", "2023-03-01");
    await expect(page.locator("#totalDays")).toHaveText("1");
    await calc(page, "1900-01-01", "2000-01-01");
    await expect(page.locator("#totalDays")).toHaveText(inr(age("1900-01-01", "2000-01-01").totalDays));
  });

  test("born today: zero years, months and days", async ({ page }) => {
    await calc(page, TODAY);
    expect(await shown(page)).toEqual({ years: 0, months: 0, days: 0 });
    await expect(page.locator("#totalDays")).toHaveText("0");
  });

  test("the next 10,000-day milestone", async ({ page }) => {
    // Born 2000-01-01: 9,806 days old on 6 Nov 2026, so the next milestone is day 10,000.
    await calc(page, "2000-01-01");
    expect(age("2000-01-01", TODAY).totalDays).toBeLessThan(10000);
    await expect(page.locator("#tenkDate")).toContainText("10,000th Day");
    const d = addDays("2000-01-01", 10000); // "2027-05-19"
    const [y, m, day] = d.split("-").map(Number);
    await expect(page.locator("#tenkDate")).toContainText(String(day));
    await expect(page.locator("#tenkDate")).toContainText(String(y));
    await expect(page.locator("#tenkDate")).toContainText(new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", timeZone: "UTC" }));
  });

  test("a birth date after the 'as on' date is refused", async ({ page, dialogs }) => {
    await page.locator("#birthDate").fill("2027-01-01");
    await page.getByRole("button", { name: "Calculate Age" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/cannot be in the future/i);
    await expect(page.locator("#results")).toBeHidden();
    await expect(page.locator("#placeholder")).toBeVisible();
  });

  test("a missing date is asked for", async ({ page, dialogs }) => {
    await page.getByRole("button", { name: "Calculate Age" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/select both dates/i);
    await expect(page.locator("#results")).toBeHidden();
  });

  test("Set to Today's Date puts today back", async ({ page }) => {
    await page.locator("#currentDate").fill("2001-01-01");
    await page.getByRole("button", { name: "Set to Today's Date" }).click();
    await expect(page.locator("#currentDate")).toHaveValue(TODAY);
  });

  test("the birth date is saved and comes back after a reload", async ({ page }) => {
    await page.locator("#birthDate").fill("1993-04-21");
    await page.reload();
    await expect(page.locator("#birthDate")).toHaveValue("1993-04-21");
    await page.getByRole("button", { name: "Calculate Age" }).click();
    await expectAge(page, "1993-04-21", TODAY);
  });

  test("Reset clears the birth date and keeps today as the 'as on' date", async ({ page, dialogs }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: Reset sets each field back to its HTML default. The 'as on' field has none (today is
    // filled in by script), so after Reset it is blank and Calculate only says "Please select both dates".
    await page.locator("#birthDate").fill("1993-04-21");
    await page.getByRole("button", { name: "Reset" }).click();
    expect(dialogs.messages.at(-1)).toMatch(/reset/i);
    await expect(page.locator("#birthDate")).toHaveValue("");
    await expect(page.locator("#currentDate")).toHaveValue(TODAY);
  });

  test("Share sends the age in words on WhatsApp", async ({ page }) => {
    await calc(page, "1990-05-15");
    const words = (await page.locator("#ageInWords").innerText()).trim();
    await expectWhatsAppShare(page, /share/i, ["My Age", words]);
  });

  test("days are never negative at a month end (31 Jan to 1 Mar)", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: days are borrowed from the month before the 'as on' date. From 31 Jan to 1 Mar 2026 that gives
    // 1 month and -2 days. The anniversary count gives 1 month 1 day (clamping 31 Jan + 1 month to 28 Feb) or
    // 29 days (rolling it to 3 Mar). Born on the 30th or 31st, many dates in March show negative days.
    await calc(page, "2026-01-31", "2026-03-01");
    const a = age("2026-01-31", "2026-03-01");
    expect([a.clamp, a.roll]).toContainEqual(await shown(page));
  });

  test("days to the next birthday", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: the page reads dates as UTC midnight (new Date("YYYY-MM-DD")) but builds the next birthday at local
    // midnight. In India that is 5 h 30 min apart, so "days to go" is always one short: 25 Dec is 49 days after
    // 6 Nov 2026, the page says 48. On the birthday itself it says 364 days instead of today.
    await calc(page, "2000-12-25");
    await expect(page.locator("#nextBirthday")).toContainText(`(${daysToNextBirthday("2000-12-25", TODAY)} days to go)`);
  });

  test("the milestone sentence names the right number of days", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: the sentence is hard-coded "You will be 10,000 days old on ..." while the date is for the next
    // milestone, 20,000 or 30,000 days. Born 1990-01-01 it reads "10,000 days old on 4 October 2044
    // (20,000th Day)".
    await calc(page, "1990-01-01");
    const sentence = page.locator("p", { hasText: "Next Milestone:" });
    await expect(sentence).toContainText("20,000 days old");
    await expect(sentence).not.toContainText("10,000 days old");
  });

  test("the next milestone is never in the past", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: milestones stop at 30,000 days, so anyone older than about 82 is shown a date that has
    // already gone. Born 1940-01-01 (31,721 days old) the next round milestone is 40,000 days.
    await calc(page, "1940-01-01");
    await expect(page.locator("#tenkDate")).toContainText("40,000th Day");
  });
});

test.describe("Age Calculator just after midnight in India", () => {
  test("Set to Today's Date gives today's date between midnight and 5:30 am", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: today is taken from toISOString(), which is UTC. From 00:00 to 05:30 IST that is still
    // yesterday, so the 'as on' date and every age are a day behind for five and a half hours every night.
    await page.clock.setFixedTime(new Date("2026-11-06T02:00:00+05:30"));
    await page.goto("/age-calculator/");
    await expect(page.locator("#currentDate")).toHaveValue("2026-11-06");
  });
});

test.describe("Age Calculator in a US time zone", () => {
  test.use({ timezoneId: "America/New_York" });

  test("age is the same wherever the visitor is", async ({ page }) => {
    // FIXED 2026-11-06, kept as a regression test. Was a known bug: dates are parsed as UTC midnight and read back in local time, which is the previous evening west
    // of UTC. Born 1 Mar 2000, on 6 Nov 2026 the page says 26 years 8 months 7 days. The right answer is 26 years
    // 8 months 5 days. Visitors in the Americas (NRIs included) get wrong ages.
    await page.clock.setFixedTime(new Date("2026-11-06T10:00:00-05:00"));
    await page.goto("/age-calculator/");
    await calc(page, "2000-03-01", "2026-11-06");
    const a = age("2000-03-01", "2026-11-06");
    expect([a.clamp, a.roll]).toContainEqual(await shown(page));
  });
});
