// Shared Playwright fixtures and helpers for every spec.
//
// What every test gets for free:
//  - Third-party requests never leave the machine. AdSense, Google Analytics and the Font Awesome stylesheet are
//    answered with empty files. Chart.js (used by the SIP page) is served from node_modules, so the chart really runs.
//  - Any console error or uncaught page error fails the test (checked when the test ends).
//  - alert() and confirm() dialogs are recorded and accepted. Set `dialogs.respond = "dismiss"` to press Cancel.
//  - Clipboard read and write are allowed, so copy buttons can be checked.
//  - window.print() is replaced by a counter (window.__printCalls), so Print buttons can be checked without a dialog.
//
// Selectors: element IDs, roles and accessible names only. Never Tailwind classes or styles (the look is being
// redesigned). Visibility is checked with toBeVisible/toBeHidden, which do not depend on class names.
import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const CHART_JS = fs.readFileSync(fileURLToPath(new URL("../../node_modules/chart.js/dist/chart.umd.min.js", import.meta.url)));

// BASE_URL=https://www.quicktoolsindia.com runs the suite against the live site: its host then counts as "the site",
// and third parties (AdSense, Analytics) are still stubbed, so test visits never reach Google Analytics.
const SITE_HOSTS = new Set(["127.0.0.1", "localhost"]);
if (process.env.BASE_URL) {
  const h = new URL(process.env.BASE_URL).hostname;
  SITE_HOSTS.add(h).add(h.replace(/^www\./, "")).add("www." + h.replace(/^www\./, ""));
}

function isLocal(url) {
  const { hostname, protocol } = new URL(url);
  return protocol === "data:" || protocol === "blob:" || SITE_HOSTS.has(hostname);
}

async function stubThirdParty(route) {
  const url = route.request().url();
  if (url.startsWith("https://cdn.jsdelivr.net/npm/chart.js")) {
    return route.fulfill({ status: 200, contentType: "application/javascript", body: CHART_JS });
  }
  const type = route.request().resourceType();
  if (type === "script") return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  if (type === "stylesheet") return route.fulfill({ status: 200, contentType: "text/css", body: "" });
  if (type === "document") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>stub</title>" });
  return route.fulfill({ status: 204, body: "" });
}

const dialogState = new WeakMap();

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    await context.route((url) => !isLocal(url.href), stubThirdParty);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
    await context.addInitScript(() => {
      window.__printCalls = 0;
      window.print = () => { window.__printCalls += 1; };
    });
    await use(context);
  },

  page: async ({ page }, use) => {
    const problems = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`console error on ${page.url()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => problems.push(`page error on ${page.url()}: ${err.message}`));
    const state = { messages: [], respond: "accept" };
    dialogState.set(page, state);
    page.on("dialog", async (d) => {
      state.messages.push(d.message());
      if (state.respond === "accept") await d.accept();
      else await d.dismiss();
    });
    await use(page);
    expect(problems, "no console errors and no page errors").toEqual([]);
  },

  /** { messages: string[], respond: "accept" | "dismiss" } for the current page. */
  dialogs: async ({ page }, use) => {
    await use(dialogState.get(page));
  },
});

export { expect };

// ───────────────────────── Reading figures off the page ─────────────────────────

/**
 * Read an amount as the page shows it and return its value and how precise the display is.
 * "₹1,23,456" -> 123456 (to within 0.5), "₹11.62 Lakh" -> 1162000 (to within 500), "₹1.23 Cr" -> 12300000
 * (to within 50000), "- ₹50,000" -> 50000 (the minus is a label on deduction lines), "USD 357,170" -> 357170.
 */
export function parseShown(text) {
  const t = String(text).replace(/ /g, " ").trim();
  const m = t.match(/(?:₹|Rs\.?|INR|USD|GBP|EUR|AUD|CAD)?\s*(-?\d[\d,]*(?:\.\d+)?)\s*(crore|cr|lakh|lac)?/i);
  if (!m) throw new Error(`No amount in ${JSON.stringify(text)}`);
  const digits = m[1].replace(/,/g, "");
  const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
  const unit = m[2] ? (/^cr/i.test(m[2]) ? 1e7 : 1e5) : 1;
  return { value: Number(digits) * unit, tol: 0.5 * 10 ** -decimals * unit, text: t };
}

/**
 * Expect the amount shown in `locator` to equal `expected` within the precision of the display.
 * `slack` adds room for a page that rounds an intermediate figure before showing a sum (default 0.01 rupee).
 * `firstLine` reads only the element's first text node (the home loan page puts a <small> note after the amount).
 */
export async function expectAmount(locator, expected, { slack = 0.01, firstLine = false, label = "", timeout = 5000 } = {}) {
  const read = () =>
    firstLine ? locator.evaluate((el) => (el.childNodes[0] ? el.childNodes[0].textContent : "")) : locator.textContent();
  const deadline = Date.now() + timeout;
  let text = "";
  let shown = null;
  for (;;) {
    text = (await read()) ?? "";
    try {
      shown = parseShown(text);
    } catch {
      shown = null;
    }
    if (shown && Math.abs(shown.value - expected) <= shown.tol + slack + 1e-6) return;
    if (Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const name = label || (await describe(locator));
  const within = shown ? ` (display precision ±${shown.tol + slack})` : "";
  expect(false, `${name}: expected about ${expected.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${within}, page shows ${JSON.stringify(text.trim())}`).toBe(true);
}

async function describe(locator) {
  try {
    return await locator.evaluate((el) => "#" + (el.id || el.tagName.toLowerCase()));
  } catch {
    return String(locator);
  }
}

/** The visible page never shows NaN, Infinity or "undefined" (a sign of maths run on an empty or bad input). */
export async function expectNoBadNumbers(page) {
  const text = await page.locator("body").innerText();
  const bad = text.split("\n").filter((line) => /\bNaN\b|Infinity|\bundefined\b/.test(line));
  expect(bad, "lines showing NaN, Infinity or undefined").toEqual([]);
}

/** Whole rupees with Indian grouping, for messages and exact string checks: 2400000 -> "24,00,000". */
export const inr = (x) => Math.round(x).toLocaleString("en-IN");

// ───────────────────────── Driving controls ─────────────────────────

/** Type into a field the way a person does: clear it, then key in each character (fires input on every key). */
export async function typeInto(locator, text) {
  await locator.fill("");
  await locator.pressSequentially(String(text));
}

/** Set a field in one step (fires a single input event), like pasting. */
export async function setField(locator, value) {
  await locator.fill(String(value));
}

/** Move a slider to its minimum or maximum with the keyboard, like a person would (fires input and change). */
export async function sliderTo(locator, where) {
  await locator.focus();
  await locator.press(where === "min" ? "Home" : "End");
}

/** Set a slider to an exact value and fire the events a drag fires. */
export async function setSlider(locator, value) {
  await locator.evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

/** Press a button by its accessible name. */
export async function press(page, name, options = {}) {
  await page.getByRole("button", { name, ...options }).click();
}

/**
 * Check that a field with Indian formatting groups digits as you type (2400000 shows 24,00,000), then put back
 * the value it had.
 */
export async function expectIndianGrouping(locator) {
  const before = await locator.inputValue();
  await typeInto(locator, "2400000");
  await expect(locator).toHaveValue("24,00,000");
  await typeInto(locator, "12345678");
  await expect(locator).toHaveValue("1,23,45,678");
  await setField(locator, before);
}

/**
 * Click a WhatsApp share button and check it opens wa.me with the expected words in the message.
 * Returns the decoded share text.
 */
export async function expectWhatsAppShare(page, buttonName, mustContain) {
  const popupPromise = page.context().waitForEvent("page");
  await page.getByRole("button", { name: buttonName }).click();
  const popup = await popupPromise;
  const url = popup.url() === "about:blank" ? (await popup.waitForURL(/wa\.me/), popup.url()) : popup.url();
  expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
  const text = decodeURIComponent(url.replace(/^https:\/\/wa\.me\/\?text=/, ""));
  for (const part of [].concat(mustContain)) expect(text).toContain(part);
  await popup.close();
  return text;
}
