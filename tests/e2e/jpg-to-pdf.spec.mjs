// JPG to PDF (/jpg-to-pdf/). Every PDF the page makes is downloaded and opened again with pdf-lib to check the page
// count, the page sizes and the order. A4 is 595 x 842 points, US Letter 612 x 792.
import fs from "node:fs";
import { test, expect } from "./fixtures.mjs";
import { auditLayout } from "../lib/layout-audit.mjs";
import { png, jpeg, withOrientation, readPdf } from "../lib/files.mjs";

async function makePdf(page) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Create PDF" }).click()]);
  const info = await readPdf(fs.readFileSync(await dl.path()));
  return { name: dl.suggestedFilename(), ...info };
}

const file = (name, buffer, mimeType) => ({ name, mimeType, buffer });

test.describe("JPG to PDF", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/jpg-to-pdf/");
  });

  test("starts empty with Create PDF switched off", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Create PDF" })).toBeDisabled();
    await expect(page.locator("#pdfStatus")).toHaveText("Add images to begin.");
    await expect(page.locator("#imageCount")).toHaveText("0");
  });

  test("one wide photo makes one landscape A4 page named after it", async ({ page }) => {
    await page.locator("#imageInput").setInputFiles([file("holiday.jpg", await jpeg(page, 400, 300), "image/jpeg")]);
    await expect(page.locator("#imageCount")).toHaveText("1");
    const out = await makePdf(page);
    expect(out.name).toBe("holiday.pdf");
    expect(out.pages).toBe(1);
    expect(out.sizes).toEqual([[842, 595]]);
    expect(out.producer).toBe("QuickTools Plus JPG to PDF");
    await expect(page.locator("#pdfStatus")).toContainText("Done: 1 page");
  });

  test("pages follow the list, and the arrows change the order", async ({ page }) => {
    await page.locator("#imageInput").setInputFiles([
      file("tall.png", png(300, 600), "image/png"),
      file("wide.jpg", await jpeg(page, 600, 300), "image/jpeg"),
    ]);
    let out = await makePdf(page);
    expect(out.name).toBe("images.pdf");
    expect(out.sizes).toEqual([[595, 842], [842, 595]]);
    await page.getByRole("button", { name: "Move wide.jpg up" }).click();
    await expect(page.locator("#imageList li").first()).toContainText("wide.jpg");
    out = await makePdf(page);
    expect(out.sizes).toEqual([[842, 595], [595, 842]]);
  });

  test("dragging a row moves it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "drag with a mouse is a desktop gesture, phones use the arrows");
    await page.locator("#imageInput").setInputFiles([
      file("a.png", png(100, 200), "image/png"), file("b.png", png(200, 100), "image/png"), file("c.png", png(100, 200), "image/png"),
    ]);
    await page.locator("#imageList li").nth(2).dragTo(page.locator("#imageList li").nth(0));
    await expect(page.locator("#imageList li").first()).toContainText("c.png");
  });

  test("US Letter, forced portrait, and fit to image", async ({ page }) => {
    await page.locator("#imageInput").setInputFiles([file("wide.png", png(400, 300), "image/png")]);
    await page.locator("#pageSize").selectOption("letter");
    await page.locator("#orientation").selectOption("portrait");
    expect((await makePdf(page)).sizes).toEqual([[612, 792]]);
    await page.locator("#pageSize").selectOption("fit");
    await page.locator("#margin").selectOption("none");
    expect((await makePdf(page)).sizes).toEqual([[300, 225]]); // 400 x 300 px at 96 px an inch
  });

  test("a sideways phone photo comes out upright", async ({ page }) => {
    // Stored 400 wide and 200 tall, tagged "turn a quarter clockwise": upright it is 200 wide and 400 tall
    const photo = withOrientation(await jpeg(page, 400, 200), 6);
    await page.locator("#imageInput").setInputFiles([file("phone.jpg", photo, "image/jpeg")]);
    const out = await makePdf(page);
    expect(out.sizes).toEqual([[595, 842]]); // a portrait page, so the photo was turned
  });

  test("fifty images make fifty pages", async ({ page }) => {
    const imgs = Array.from({ length: 50 }, (_, i) => file(`scan-${String(i + 1).padStart(2, "0")}.png`, png(120, 160, [i * 5, 80, 160]), "image/png"));
    await page.locator("#imageInput").setInputFiles(imgs);
    await expect(page.locator("#imageCount")).toHaveText("50");
    const out = await makePdf(page);
    expect(out.pages).toBe(50);
    await expect(page.locator("#pdfStatus")).toContainText("Done: 50 pages");
  });

  test("a file that is not an image is named and left out", async ({ page }) => {
    await page.locator("#imageInput").setInputFiles([
      file("notes.txt", Buffer.from("hello"), "text/plain"),
      file("ok.png", png(50, 50), "image/png"),
    ]);
    await expect(page.locator("#fileErrors")).toHaveText("Not an image, so left out: notes.txt.");
    await expect(page.locator("#imageCount")).toHaveText("1");
  });

  test("an image the browser cannot open gives a clear message, not a broken PDF", async ({ page }) => {
    await page.locator("#imageInput").setInputFiles([file("photo.heic", Buffer.from("not really an image"), "image/heic")]);
    await page.getByRole("button", { name: "Create PDF" }).click();
    await expect(page.locator("#fileErrors")).toContainText("This browser cannot open photo.heic");
    await expect(page.locator("#pdfStatus")).toHaveText("The PDF was not made.");
  });

  test("Remove and Remove all", async ({ page }) => {
    await page.locator("#imageInput").setInputFiles([file("a.png", png(10, 10), "image/png"), file("b.png", png(10, 10), "image/png")]);
    await page.getByRole("button", { name: "Remove a.png" }).click();
    await expect(page.locator("#imageList li")).toHaveCount(1);
    await page.getByRole("button", { name: "Remove all" }).click();
    await expect(page.locator("#imageList li")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create PDF" })).toBeDisabled();
  });

  test("the image list with long file names holds together on narrow phones", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one engine is enough for this audit");
    await page.locator("#imageInput").setInputFiles([file("a-very-long-scanned-document-name-from-the-office-printer-2026-11-07.png", png(40, 60), "image/png"), file("b.png", png(60, 40), "image/png")]);
    await expect(page.locator("#imageList li")).toHaveCount(2);
    const failures = [];
    for (const width of [280, 320, 360, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const problems = await page.evaluate(auditLayout, { ignore: [".qt-brand-tag", ".qt-sticker", ".qt-ticker"], centred: ".qt-wrap" });
      if (problems.length) failures.push(`${width}px: ${problems.join(" ; ")}`);
    }
    expect(failures, "layout problems").toEqual([]);
  });
});
