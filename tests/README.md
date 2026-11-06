# Tests for QuickTools India

Three suites check the site. Two of them run in a second without a browser. The third drives the built site in Chromium, the way a visitor would.

| Suite | Command | What it checks | Time |
|---|---|---|---|
| Number to Words cases | `npm test` (first half) | 56 hand-worked cases for `src/js/number-words.js` | under a second |
| Unit tests | `npm test` (second half), or `npm run test:unit` | the maths in `src/js/calc/*.js` | about a second |
| End-to-end | `npm run test:e2e` | every built page and every control on every tool | about 2.5 minutes |

The deploy workflow runs `npm test` before every build, so the first two suites guard each deploy. The end-to-end suite needs a browser, so run it by hand before you push a change to a page.

## Running the suites

First time only:

```
npm install
```

The end-to-end suite uses `@playwright/test` 1.63.0, which drives Chromium build 1243. That build already sits in `%LOCALAPPDATA%\ms-playwright` on this PC. On another machine run `npx playwright install chromium` once.

Unit tests and the Number to Words cases:

```
npm test
```

End-to-end, which builds the site first:

```
npm run test:e2e
```

It serves `_site` on port 8941 with `scripts/serve-site.mjs` and stops the server when it finishes. Nothing stays running. Useful variations:

```
npm run test:e2e:only                                   (skip the build, test the _site you have)
npx playwright test tests/e2e/gst.spec.mjs              (one tool)
npx playwright test --project=phone                     (only the phone run)
npx playwright test -g "Reset"                          (tests whose name contains Reset)
npx playwright show-trace test-results/<folder>/trace.zip   (step through a failed test)
```

A full report of the last run is written to `test-results/e2e-results.json`.

## What the end-to-end suite covers

Every test runs twice: on a desktop window (1366 by 900) and on a phone (390 by 844, touch, mobile mode).

`site.spec.mjs` checks every built page: the tools, about, contact, the legal pages, updates, the blog index and every blog post. For each one:

- HTTP 200, a title that is not empty and is used by no other page, exactly one h1
- no console errors and no page errors
- no sideways scrolling at 360 and 390 px (phone run) and 1366 px (desktop run)
- every internal link points at a page the build made, and every in-page anchor exists
- every JSON-LD block parses, every image has alt text
- every button and form field has an accessible name (desktop run only)

It also checks the old `.html` addresses redirect, the sitemap lists exactly the built pages, the Tools menu opens and closes (click, Escape, outside click), and robots.txt, ads.txt and the `/js/calc` files are served.

One spec per tool exercises every control on the page: each field, select, slider at its minimum and maximum, checkbox, radio, tab, preset, Calculate, Reset (Cancel and OK), Copy, Share on WhatsApp and Print. It reloads the page to check that auto-save brings the values back. Each field marked for Indian digit grouping (`class="format-inr"`) is typed into, and must show 24,00,000 for 2400000.

| Page | Spec |
|---|---|
| Home page amount-in-words box, Number to Words | `number-to-words.spec.mjs` |
| Lakh Crore in Numbers, with every table row | `lakh-crore.spec.mjs` |
| Home Loan, with the worked examples and the EMI table | `home-loan.spec.mjs` |
| Car Loan | `car-loan.spec.mjs` |
| EMI Prepayment | `emi-prepayment.spec.mjs` |
| SIP, with the chart data, worked example and table | `sip.spec.mjs` |
| PPF | `ppf.spec.mjs` |
| Sukanya Samriddhi | `ssy.spec.mjs` |
| GST, every rate both ways | `gst.spec.mjs` |
| Income Tax, with the page's worked comparisons | `income-tax.spec.mjs` |
| Salary, with the page's worked example table | `salary.spec.mjs` |
| Age, in India time and in a US time zone | `age.spec.mjs` |
| Cash Counter | `cash-counter.spec.mjs` |
| Image Resizer, with a PNG made in the test, JPEG and WebP downloads | `image-resizer.spec.mjs` |
| Study Abroad | `study-abroad.spec.mjs` |
| Wedding Cost | `wedding-cost.spec.mjs` |

Things every spec gets from `tests/e2e/fixtures.mjs`:

- Third-party files never load. AdSense, Google Analytics and Font Awesome get empty answers. Chart.js is served from `node_modules`, so the SIP chart really draws.
- A console error or page error fails the test.
- `alert` and `confirm` are recorded and accepted. A test can set `dialogs.respond = "dismiss"` to press Cancel.
- The clipboard can be read, so Copy buttons are checked for real.
- `window.print` is replaced by a counter, so Print is checked without a dialog.

## Where the expected figures come from

Expected values are never copied from the page. `tests/lib/reference.mjs` works them out from the published formula or the law, and every function there names its source. A few examples:

- EMI from the present-value form of the loan formula, and a month-by-month schedule for prepayments
- SIP by adding up each instalment's growth, following the page's stated convention (start of month, 12% a year read as 1% a month)
- PPF and SSY year by year under the PPF Scheme, 2019 and the SSA Scheme, 2019, with the partial withdrawal rule
- Income tax from the Income-tax Act, 2025 and the Finance Act, 2026, as mapped in `revenue-hq/research/tax_law_2026/income_tax_act_2025_map_2026-11-06.md`, including surcharge with marginal relief for the known-gap test
- Age by counting anniversaries. At month ends and for 29 February two conventions are in use, so the tests accept either one.

The page shows rounded figures such as "₹11.62 Lakh". `expectAmount` in the fixtures reads the shown figure, works out how precise it is (here, to within ₹500) and compares the reference value within that precision. So a test keeps working if the redesign shows more digits.

## Known bugs

A test for a known bug states the right answer and is marked as expected to fail. In Playwright that is `test.fail()`. In the unit tests it is `knownBug(...)` from `tests/unit/_helpers.mjs`, which only counts a failed assertion, so a typo cannot hide as a bug. When someone fixes the bug, the test starts to pass, the run goes red with "expected to fail" or "no longer reproduces", and the marker has to come off. Each marked test has a comment saying what is wrong and what the right figure is.

| Page | Known bug | Test |
|---|---|---|
| Home Loan, Car Loan, EMI Prepayment, SIP, Income Tax, Salary | **Fixed 2026-11-06.** A typed amount with Indian commas came back empty after a reload. The page's own script ran before `main.js`, so auto-save wrote "30,00,000" into a number field. `initAutoSave` now upgrades the fields first. | "a typed ... is saved and comes back after a reload" (now a regression test) |
| Car Loan | 0% interest shows ₹NaN | "0% interest gives an EMI of loan / months" |
| Car Loan | A down payment above the on-road price gives a negative loan and EMI | "a down payment above the on-road price ..." |
| Car Loan | The Used Car choice is not restored after a reload, while the rate is | "the Used Car choice is saved ..." |
| EMI Prepayment | A lump sum above the loan is counted in full in "total paid" | "a lump sum larger than the loan ..." |
| SIP | Slider moves are never saved, and typing does not move the slider | two tests |
| PPF | Partial withdrawal uses 50% of the year-7 balance, not the PPF Scheme rule | "the partial withdrawal follows the PPF rule" |
| PPF, SSY | "30% tax bracket saves" leaves out the 4% cess | "the yearly tax saving includes the 4% cess" |
| SSY | An age such as 5.5 gives a ₹0 withdrawal at 18 | "a part-year age ..." |
| GST | Typing 1000.50 key by key gives 1,00,050 (the decimal point is eaten) | "an amount with paise can be typed key by key" |
| Income Tax | 80D is not capped at the legal ₹1,00,000 | "80D is capped ..." |
| Income Tax | No surcharge above ₹50 lakh. The page says so, kept as a known gap. | "true tax above 50 lakh includes surcharge" |
| Salary | **Fixed 2026-11-06.** The 50% HRA option named 4 cities. Rule 279 gives 8 from tax year 2026-27 and the option now lists all 8. | "HRA at 50% covers all eight Rule 279 cities" (now a regression test) |
| Salary | Professional tax 0 becomes ₹200 | "professional tax can be set to zero" |
| Salary | The employee's 0.75% ESI is never deducted | "an ESI-covered salary deducts the employee's 0.75%" |
| Salary | At 60% basic in a metro the parts add up to more than the CTC | "the salary parts never add up to more than the CTC" |
| Age | Negative days at month ends, days to birthday one short in India, today is yesterday before 5:30 am, wrong age in US time zones, milestone sentence and past milestones | six tests in `age.spec.mjs` |
| Cash Counter | The words line is digits with unit names | "the total in words is written in words" |
| Study Abroad | Negative years give a negative monthly saving | "negative years are refused" |
| Wedding Cost | With a destination wedding the breakdown lines add up to more than the total | "the cost breakdown adds up to the total" |
| 13 calculator pages | **Fixed 2026-11-06.** Field labels were not tied to their fields, and SIP had an icon-only Reset button. Labels now use `for=`, sliders and the cash counter fields carry names. | `KNOWN_UNNAMED_CONTROLS` in `site.spec.mjs` (now empty) |

`KNOWN_UNNAMED_CONTROLS` is empty. A page that loses a name fails at once.

## Conventions the pages do not state

These are not marked as bugs, but a reader cannot see them on the page:

- PPF and SSY assume each year's deposit is made by 5 April, so it earns the whole year's interest. That is the best case.
- Study Abroad and Wedding Cost work out the monthly saving at 12% a year compounded yearly, saved at the end of each month. The SIP page uses 1% a month, saved at the start. The two give different answers for the same goal.
- **Updated 2026-11-06.** Study Abroad converted at ₹83 to the dollar and similar stale rates. It now uses SBI card selling rates of 6 Nov 2026, stated on the page. Refresh them, and the test tables, every few months.
- Choosing a country on Study Abroad, or a preset on several pages, writes the amount without Indian commas. The sums are still right.

## How to add tests for a new tool

1. Put the maths in `src/js/calc/<tool>.js`. Copy the shape of `src/js/calc/sip.js`: one function per sum, no DOM, and the last three lines that make it `QTCalc.<tool>` in the browser and `require()` in Node.
2. Load it on the page with `<script src="/js/calc/<tool>.js"></script>` before the page's own script, and call it from there. `src/js` is copied to the site as is, so no config change is needed.
3. Add the independent formula to `tests/lib/reference.mjs`, written from the rule or the law, with the source in a comment. Do not copy the module.
4. Write `tests/unit/<tool>.test.mjs`. Start with two or three figures worked by hand, then compare the module with the reference over a grid of inputs, then the edges: zero, empty, negative, very large, and whatever is special to the tool. `npm run test:unit` picks the file up by itself.
5. Write `tests/e2e/<tool>.spec.mjs`. Import `test`, `expect` and the helpers from `./fixtures.mjs`. Find things by element ID, role or accessible name only, never by Tailwind classes or styles. Cover every control, Reset, the reload, and Indian grouping if the page has rupee fields. Use `expectAmount` for any figure the page shows.
6. Add the page's URL to `TOOL_PAGES` in `tests/lib/site.mjs`. `site.spec.mjs` finds new pages in `_site` by itself.
7. Run `npm test` and `npm run test:e2e`. If you find a fault you are not fixing now, write the test for the right answer, mark it `test.fail()` or `knownBug(...)` with a comment, and add it to the table above.

## Files

```
playwright.config.mjs         projects, port 8941, the static server
scripts/serve-site.mjs        tiny static server for _site
scripts/run-unit-tests.mjs    runs tests/unit/*.test.mjs with node --test
scripts/test-number-words.mjs the Number to Words cases (npm test)
tests/lib/reference.mjs       independent formulas and rules, with sources
tests/lib/number-words-cases.mjs   the Number to Words cases, shared by the script and the page test
tests/lib/site.mjs            the list of built pages
tests/lib/png.mjs             makes a PNG in memory for the image resizer
tests/e2e/fixtures.mjs        shared fixtures and helpers
tests/e2e/*.spec.mjs          one spec per page, plus site.spec.mjs
tests/unit/*.test.mjs         unit tests for src/js/calc
```


## Running the suite against the live site

After a deploy, run the same browser suite against production. No local server is started, and analytics and ad
requests are answered locally, so test visits never count as real users.

- Git Bash: `BASE_URL=https://www.quicktoolsindia.com npx playwright test`
- PowerShell: `$env:BASE_URL = "https://www.quicktoolsindia.com"; npx playwright test; Remove-Item Env:BASE_URL`

First live run: 2026-11-06, right after the redesign went live. Every test passed.
