// Checks that apply to every built page: tools, about, contact, legal, updates, the blog index and every post.
import { test, expect } from "./fixtures.mjs";
import { pages, redirects, servedPaths } from "../lib/site.mjs";

const SERVED = servedPaths();
const SITE_HOSTS = new Set(["www.quicktoolsindia.com", "quicktoolsindia.com"]);

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Widths to check for sideways scrolling: the two phone widths on the phone project, the laptop on desktop. */
const widthsFor = (project) => (project === "phone" ? [360, 390] : [1366]);

const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.describe("site-wide facts (checked once)", () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "static facts, desktop run only"));

  test("every page has a unique, non-empty title", () => {
    const seen = new Map();
    for (const p of pages) {
      const title = decode(p.title);
      expect(title, `${p.url} has a title`).not.toBe("");
      expect(seen.get(title), `title "${title}" is used by ${seen.get(title)} and ${p.url}`).toBeUndefined();
      seen.set(title, p.url);
    }
    expect(pages.length).toBeGreaterThan(30);
  });

  test("the sitemap lists every page and nothing that is not built", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1].trim()));
    for (const loc of locs) {
      expect(SITE_HOSTS.has(loc.hostname), `${loc} is on the site's own host`).toBe(true);
      expect(SERVED.has(loc.pathname), `${loc.pathname} in the sitemap is a built page`).toBe(true);
    }
    const listed = new Set(locs.map((l) => l.pathname));
    for (const p of pages) expect(listed.has(p.url), `${p.url} is in the sitemap`).toBe(true);
  });

  test("robots.txt, ads.txt and the favicon are served", async ({ request }) => {
    for (const path of ["/robots.txt", "/ads.txt", "/favicon.svg", "/og-image.png", "/js/main.js", "/js/number-words.js", "/css/styles.css"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/sitemap/i);
  });
});

for (const p of pages) {
  test(`page ${p.url} loads cleanly and is well formed`, async ({ page }, testInfo) => {
    const res = await page.goto(p.url);
    expect(res.status(), "HTTP status").toBe(200);

    const title = await page.title();
    expect(title.trim(), "title").not.toBe("");
    expect(title).toBe(decode(p.title));

    await expect(page.locator("h1"), "exactly one h1").toHaveCount(1);

    const badJson = await page.evaluate(() =>
      [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s, i) => {
        try {
          JSON.parse(s.textContent);
          return [];
        } catch (e) {
          return [`block ${i + 1}: ${e.message}`];
        }
      }),
    );
    expect(badJson, "every JSON-LD block parses").toEqual([]);

    const noAlt = await page.evaluate(() =>
      [...document.querySelectorAll("img")]
        .filter((img) => !(img.getAttribute("alt") || "").trim() && img.getAttribute("role") !== "presentation" && img.getAttribute("aria-hidden") !== "true")
        .map((img) => img.getAttribute("src")),
    );
    expect(noAlt, "images have alt text").toEqual([]);

    const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.href, raw: a.getAttribute("href") })));
    const broken = [];
    for (const { href, raw } of links) {
      if (/^(mailto|tel|javascript):/i.test(raw)) continue;
      const u = new URL(href);
      const internal = u.origin === new URL(page.url()).origin || SITE_HOSTS.has(u.hostname);
      if (!internal) continue;
      if (!SERVED.has(u.pathname)) broken.push(raw);
      else if (u.hash && u.pathname === new URL(page.url()).pathname) {
        const id = decodeURIComponent(u.hash.slice(1));
        const exists = await page.evaluate((x) => !!(document.getElementById(x) || document.getElementsByName(x).length), id);
        if (!exists) broken.push(raw);
      }
    }
    expect(broken, "internal links that do not resolve").toEqual([]);

    for (const width of widthsFor(testInfo.project.name)) {
      await page.setViewportSize({ width, height: 844 });
      await settle(page);
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        if (root.scrollWidth <= root.clientWidth) return null;
        const wide = [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 1 && el.getClientRects().length)
          .slice(0, 5)
          .map((el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + " right=" + Math.round(el.getBoundingClientRect().right));
        return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, wide };
      });
      expect(overflow, `no sideways scroll at ${width}px`).toBeNull();
    }
  });
}

// KNOWN BUG (accessibility): on these pages the visible field labels are not tied to their fields (no for=, not
// wrapping the field), so screen readers announce unnamed fields. The SIP page also has an icon-only Reset button
// with no name. Remove a page from this list once its markup is fixed; the test then has to pass.
const KNOWN_UNNAMED_CONTROLS = new Set([
  "/age-calculator/", "/car-loan-calculator/", "/cash-counter/", "/emi-prepayment-calculator/", "/gst-calculator/",
  "/image-resizer/", "/income-tax-calculator/", "/ppf-calculator/", "/salary-calculator/", "/sip-calculator/",
  "/ssy-calculator/", "/study-abroad-calculator/", "/wedding-cost-calculator/",
]);

for (const p of pages) {
  test(`page ${p.url}: every button and form field has an accessible name`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "markup check, desktop run only");
    if (KNOWN_UNNAMED_CONTROLS.has(p.url)) test.fail();
    await page.goto(p.url);
    const unnamed = await page.evaluate(() => {
      const named = (el) => el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title");
      const buttons = [...document.querySelectorAll("button, [role=button]")]
        .filter((b) => !(b.textContent || "").trim() && !named(b))
        .map((b) => "button " + (b.id || b.getAttribute("onclick") || ""));
      const fields = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
        .filter((el) => !(el.labels && el.labels.length) && !named(el))
        .map((el) => (el.id ? "#" + el.id : el.type));
      return [...buttons, ...fields];
    });
    expect(unnamed, "controls without an accessible name").toEqual([]);
  });
}

for (const r of redirects) {
  test(`old address ${r.url} redirects to ${r.target}`, async ({ page }) => {
    const res = await page.goto(r.url, { waitUntil: "commit" });
    expect(res.status()).toBe(200);
    expect(SERVED.has(r.target), `${r.target} exists`).toBe(true);
    await page.waitForURL((u) => u.pathname === r.target);
    await expect(page.locator("h1")).toHaveCount(1);
  });
}

test.describe("header Tools menu", () => {
  test("opens, lists every tool, and closes with Escape or an outside click", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Tools" });
    const menu = page.locator("#dropdownMenu"); // the home page also has a section named "All tools"
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toBeVisible();
    for (const name of ["Number to Words", "Lakh Crore in Numbers", "Cash Counter", "Home Loan EMI", "Car Loan", "EMI Prepayment",
      "Income Tax", "Salary, CTC to In-hand", "GST", "SIP", "PPF", "Sukanya Samriddhi", "Study Abroad", "Wedding Cost",
      "Age Calculator", "Image Resizer"]) {
      await expect(menu.getByRole("link", { name, exact: true })).toBeVisible();
    }

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(menu).toBeVisible();
    // The open menu covers the top of the page, so click the footer (scrolled into view) as the "outside" spot.
    await page.locator("footer").click({ position: { x: 2, y: 2 } });
    await expect(menu).toBeHidden();

    await toggle.click();
    await toggle.click();
    await expect(menu).toBeHidden();
  });

  test("a menu link opens the tool and marks it as the current page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Tools" }).click();
    await page.getByRole("region", { name: "All tools" }).getByRole("link", { name: "GST", exact: true }).click();
    await page.waitForURL("**/gst-calculator/");
    await page.getByRole("button", { name: "Tools" }).click();
    await expect(page.getByRole("region", { name: "All tools" }).getByRole("link", { name: "GST", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
