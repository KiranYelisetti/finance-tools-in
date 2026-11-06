// QR Code Generator (/qr-code-generator/). Every code the page draws is read back with jsQR, a decoder that has
// nothing to do with the generator, so a test passes only if a phone could really scan the code.
import fs from "node:fs";
import { createRequire } from "node:module";
import { test, expect, setField } from "./fixtures.mjs";

const require = createRequire(import.meta.url);
const jsQR = require("jsqr");

/** Decode the code the page would download as PNG (drawn at the small size to keep the test fast). */
async function scan(page) {
  await page.locator("#qrSize").selectOption("256");
  // The page redraws on the next animation frame after an input, so wait for it
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expect(page.locator("#qrPreview svg")).toBeVisible();
  const img = await page.evaluate(() => {
    const c = window.__qrCanvas();
    if (!c) return null;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: Array.from(d.data) };
  });
  expect(img, "a code is drawn").not.toBeNull();
  const out = jsQR(Uint8ClampedArray.from(img.data), img.w, img.h);
  expect(out, "the drawn code can be scanned").not.toBeNull();
  return Buffer.from(out.binaryData).toString("utf8");
}

async function pick(page, name) {
  await page.locator("#qrType").getByRole("button", { name, exact: true }).click();
}

test.describe("QR Code Generator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/qr-code-generator/");
  });

  test("opens with a working example link", async ({ page }) => {
    await expect(page.locator("#qrPreview svg")).toBeVisible();
    await expect(page.locator("#qrPayload")).toHaveText("https://www.quicktoolsplus.com/");
    expect(await scan(page)).toBe("https://www.quicktoolsplus.com/");
  });

  test("a link without https gets it, and the code updates as you type", async ({ page }) => {
    await setField(page.locator("#qrUrl"), "example.com/menu");
    await expect(page.locator("#qrPayload")).toHaveText("https://example.com/menu");
    expect(await scan(page)).toBe("https://example.com/menu");
  });

  test("a bad link shows a clear message and no code", async ({ page }) => {
    await setField(page.locator("#qrUrl"), "not a link");
    await expect(page.locator('[data-error-for="url"]')).toBeVisible();
    await expect(page.locator("#qrPreview svg")).toHaveCount(0);
    await expect(page.locator("#downloadPng")).toBeDisabled();
  });

  test("text, including Hindi and emoji, scans back exactly", async ({ page }) => {
    await pick(page, "Text");
    await expect(page.locator("#qrMessage")).toHaveText("Fill in the fields and your code appears here.");
    await setField(page.locator("#qrText"), "नमस्ते 😀 Table 7");
    expect(await scan(page)).toBe("नमस्ते 😀 Table 7");
  });

  test("Wi-Fi login with special characters", async ({ page }) => {
    await pick(page, "Wi-Fi");
    await setField(page.locator("#wifiSsid"), "Home;Net");
    await setField(page.locator("#wifiPassword"), "pass:word,1");
    expect(await scan(page)).toBe("WIFI:T:WPA;S:Home\\;Net;P:pass\\:word\\,1;;");
    await page.locator("#wifiSecurity").selectOption("nopass");
    expect(await scan(page)).toBe("WIFI:T:nopass;S:Home\\;Net;;");
  });

  test("a short WPA password is refused with a reason", async ({ page }) => {
    await pick(page, "Wi-Fi");
    await setField(page.locator("#wifiSsid"), "Home");
    await setField(page.locator("#wifiPassword"), "short");
    await expect(page.locator('[data-error-for="password"]')).toHaveText("WPA passwords are at least 8 characters long.");
  });

  test("UPI payment link with amount and note", async ({ page }) => {
    await pick(page, "UPI payment");
    await setField(page.locator("#upiId"), "shop@okaxis");
    await setField(page.locator("#upiName"), "Ravi Stores");
    await setField(page.locator("#upiAmount"), "1,250.5");
    await setField(page.locator("#upiNote"), "Order 42");
    const want = "upi://pay?pa=shop@okaxis&pn=Ravi%20Stores&am=1250.50&cu=INR&tn=Order%2042";
    await expect(page.locator("#qrPayload")).toHaveText(want);
    expect(await scan(page)).toBe(want);
  });

  test("a UPI ID without the @ part is refused", async ({ page }) => {
    await pick(page, "UPI payment");
    await setField(page.locator("#upiName"), "Ravi");
    await setField(page.locator("#upiId"), "ravi");
    await expect(page.locator('[data-error-for="upiId"]')).toBeVisible();
    await expect(page.locator("#qrPreview svg")).toHaveCount(0);
  });

  test("phone and email", async ({ page }) => {
    await pick(page, "Phone");
    await setField(page.locator("#qrPhone"), "+91 98765 43210");
    expect(await scan(page)).toBe("tel:+919876543210");
    await pick(page, "Email");
    await setField(page.locator("#qrEmail"), "hello@example.com");
    await setField(page.locator("#qrSubject"), "Hi");
    expect(await scan(page)).toBe("mailto:hello@example.com?subject=Hi");
  });

  test("every error correction level scans", async ({ page }) => {
    for (const level of ["L", "M", "Q", "H"]) {
      await page.locator("#qrLevel").selectOption(level);
      expect(await scan(page), level).toBe("https://www.quicktoolsplus.com/");
    }
  });

  test("text too long for the level says so instead of breaking", async ({ page }) => {
    await pick(page, "Text");
    await page.locator("#qrLevel").selectOption("H");
    await setField(page.locator("#qrText"), "x".repeat(2000)); // over the 1,273 bytes High holds, under the 2,953 of Low
    await expect(page.locator("#qrMessage")).toContainText("Too long for a QR code");
    await expect(page.locator("#downloadPng")).toBeDisabled();
    await page.locator("#qrLevel").selectOption("L");
    await expect(page.locator("#qrPreview svg")).toBeVisible();
  });

  test("PNG and SVG downloads are real files", async ({ page }) => {
    const [png] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PNG" }).click()]);
    expect(png.suggestedFilename()).toBe("qr-code-url.png");
    const pngBytes = fs.readFileSync(await png.path());
    expect(pngBytes.subarray(1, 4).toString()).toBe("PNG");
    const [svg] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download SVG" }).click()]);
    expect(svg.suggestedFilename()).toBe("qr-code-url.svg");
    const svgText = fs.readFileSync(await svg.path(), "utf8");
    expect(svgText.startsWith("<svg")).toBe(true);
    expect(svgText).toContain('width="512"');
  });
});
