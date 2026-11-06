// Layout on every page at every screen size and zoom level: nothing overlaps, nothing runs off the screen, no text is
// cut off, controls are big enough to tap, and wide screens keep the column centred. Also text-only zoom at 200%
// (WCAG 1.4.4) and an axe-core accessibility scan (WCAG 2.2 AA, colour contrast included).
// The audit itself is in tests/lib/layout-audit.mjs.
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures.mjs";
import { pages } from "../lib/site.mjs";
import { auditLayout, ZOOM_WIDTHS } from "../lib/layout-audit.mjs";

const OPTS = {
  // Deliberate overlaps: the rotated "INDIA" tag on the logo, decorative stickers, the scrolling ticker
  ignore: [".qt-brand-tag", ".qt-sticker", ".qt-ticker", "[data-layout-ignore]"],
  centred: ".qt-wrap",
};
// Only these widths run in WebKit (iPhone): its text is measured differently, which is where overlaps hide
const PHONE_WIDTHS = ZOOM_WIDTHS.filter((z) => z.width <= 430);

// Wait for the web font and for layout to finish after a resize (WebKit can report the old layout for a frame or two)
const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60)))));
};

async function showEverything(page) {
  // Scroll-in animations start hidden. Show them so the audit sees the finished page.
  await page.evaluate(() => document.querySelectorAll(".qt-reveal").forEach((e) => e.classList.add("is-in")));
  // The page hides sections again when they leave the screen, so pin every reveal to its finished state
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; } .qt-reveal { opacity: 1 !important; transform: none !important; }" });
}

test.describe("layout at every width and zoom", () => {
  test.beforeEach(({}, testInfo) => test.skip(!["desktop", "iphone", "firefox"].includes(testInfo.project.name), "desktop covers Chromium, iphone covers WebKit"));

  for (const p of pages) {
    test(`${p.url} holds together from 280 to 2732 px`, async ({ page }, testInfo) => {
      const widths = testInfo.project.name === "iphone" ? PHONE_WIDTHS : ZOOM_WIDTHS;
      await page.goto(p.url);
      await showEverything(page);
      const failures = [];
      for (const { width, label } of widths) {
        await page.setViewportSize({ width, height: 900 });
        // WebKit's iPhone emulation keeps stale box sizes after a resize, so load the page fresh at each width there
        if (testInfo.project.name === "iphone") {
          await page.reload();
          await showEverything(page);
        }
        await settle(page);
        const problems = await page.evaluate(auditLayout, OPTS);
        if (problems.length) failures.push(`${label}: ${problems.join(" ; ")}`);
      }
      expect(failures, "layout problems").toEqual([]);
    });
  }

  for (const p of pages) {
    test(`${p.url} works with text at 200%`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "text zoom checked once");
      await page.goto(p.url);
      await showEverything(page);
      // Text-only zoom: the browser setting that enlarges text and leaves the layout width alone
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      const failures = [];
      for (const width of [1366, 768]) {
        await page.setViewportSize({ width, height: 900 });
        await settle(page);
        const problems = (await page.evaluate(auditLayout, { ...OPTS, minTarget: 0 })).filter((x) => !/^tap targets/.test(x));
        if (problems.length) failures.push(`${width}px, text 200%: ${problems.join(" ; ")}`);
      }
      expect(failures, "problems with large text").toEqual([]);
    });
  }

  for (const p of pages) {
    test(`${p.url} passes the WCAG 2.2 AA scan`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "axe runs once per page");
      await page.goto(p.url);
      await showEverything(page);
      const issues = [];
      for (const width of [1366, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await settle(page);
        for (const dark of [false, true]) {
          await page.evaluate((d) => document.documentElement.classList.toggle("dark", d), dark);
          await settle(page);
          // The giant outlined "QuickTools" in the footer is a logotype, which WCAG 1.4.3 exempts from contrast
          const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude(".qt-footer-word").analyze();
          for (const v of result.violations) {
            issues.push(`${width}px ${dark ? "night" : "day"}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
          }
        }
      }
      expect(issues, "accessibility violations").toEqual([]);
    });
  }
});
