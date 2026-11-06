// Merge PDF (/merge-pdf/). The merged download is opened again with pdf-lib to check the page count and order
// (files are told apart by their page sizes).
import fs from "node:fs";
import { test, expect } from "./fixtures.mjs";
import { auditLayout } from "../lib/layout-audit.mjs";
import { png, pdf, encryptedPdf, brokenPdf, readPdf } from "../lib/files.mjs";

const file = (name, buffer) => ({ name, mimeType: "application/pdf", buffer });

async function merge(page) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Merge PDFs" }).click()]);
  return { name: dl.suggestedFilename(), ...(await readPdf(fs.readFileSync(await dl.path()))) };
}

test.describe("Merge PDF", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/merge-pdf/");
  });

  test("needs two files before it can merge", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Merge PDFs" })).toBeDisabled();
    await page.locator("#pdfInput").setInputFiles([file("one.pdf", await pdf(2))]);
    await expect(page.locator("#pdfStatus")).toHaveText("Add one more PDF to merge.");
    await expect(page.getByRole("button", { name: "Merge PDFs" })).toBeDisabled();
    await expect(page.locator("#pdfList li").first()).toContainText("2 pages");
  });

  test("joins files in order with the right page count", async ({ page }) => {
    await page.locator("#pdfInput").setInputFiles([file("letter.pdf", await pdf(2, [300, 400])), file("form.pdf", await pdf(3, [500, 200]))]);
    await expect(page.locator("#totalPages")).toHaveText("5");
    await expect(page.locator("#summaryFiles")).toHaveText("2");
    await expect(page.locator("#pdfStatus")).toHaveText("Ready to merge 2 files into 5 pages.");
    const out = await merge(page);
    expect(out.name).toBe("merged.pdf");
    expect(out.pages).toBe(5);
    expect(out.sizes.map((s) => s[0])).toEqual([300, 300, 500, 500, 500]);
    expect(out.producer).toBe("QuickTools Plus Merge PDF");
  });

  test("the arrows change the order of the files", async ({ page }) => {
    await page.locator("#pdfInput").setInputFiles([file("a.pdf", await pdf(1, [300, 400])), file("b.pdf", await pdf(1, [500, 200]))]);
    await page.getByRole("button", { name: "Move b.pdf up" }).click();
    await expect(page.locator("#pdfList li").first()).toContainText("b.pdf");
    const out = await merge(page);
    expect(out.sizes.map((s) => s[0])).toEqual([500, 300]);
  });

  test("files added in two goes are all kept", async ({ page }) => {
    await page.locator("#pdfInput").setInputFiles([file("a.pdf", await pdf(1))]);
    await page.locator("#pdfInput").setInputFiles([file("b.pdf", await pdf(4))]);
    await expect(page.locator("#totalPages")).toHaveText("5");
  });

  test("password-protected, broken and non-PDF files are named and left out", async ({ page }) => {
    await page.locator("#pdfInput").setInputFiles([
      file("locked.pdf", await encryptedPdf()),
      file("cut.pdf", brokenPdf()),
      { name: "picture.png", mimeType: "image/png", buffer: png(10, 10) },
      file("good.pdf", await pdf(2)),
    ]);
    const box = page.locator("#fileErrors");
    await expect(box).toBeVisible();
    await expect(box).toContainText("locked.pdf is password protected");
    await expect(box).toContainText("cut.pdf could not be read");
    await expect(box).toContainText("picture.png is not a PDF file");
    await expect(page.locator("#pdfList li")).toHaveCount(1);
    await expect(page.locator("#pdfList li").first()).toContainText("good.pdf");
  });

  test("twenty files merge into one", async ({ page }) => {
    const files = [];
    for (let i = 0; i < 20; i++) files.push(file(`statement-${i + 1}.pdf`, await pdf(2, [400 + i, 500])));
    await page.locator("#pdfInput").setInputFiles(files);
    await expect(page.locator("#totalPages")).toHaveText("40");
    const out = await merge(page);
    expect(out.pages).toBe(40);
    expect(out.sizes[39][0]).toBe(419);
    await expect(page.locator("#pdfStatus")).toContainText("Done: 40 pages");
  });

  test("Remove and Remove all", async ({ page }) => {
    await page.locator("#pdfInput").setInputFiles([file("a.pdf", await pdf(1)), file("b.pdf", await pdf(1))]);
    await page.getByRole("button", { name: "Remove a.pdf" }).click();
    await expect(page.locator("#pdfList li")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Merge PDFs" })).toBeDisabled();
    await page.getByRole("button", { name: "Remove all" }).click();
    await expect(page.locator("#pdfList li")).toHaveCount(0);
  });

  test("the file list with long file names holds together on narrow phones", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "one engine is enough for this audit");
    await page.locator("#pdfInput").setInputFiles([file("bank-statement-april-to-september-2026-account-ending-1234-final.pdf", await pdf(3)), file("b.pdf", await pdf(1))]);
    await expect(page.locator("#pdfList li")).toHaveCount(2);
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
