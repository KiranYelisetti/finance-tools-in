// Image Resizer (/image-resizer/). A PNG is generated in the test (tests/lib/png.mjs), uploaded, resized and
// downloaded. The downloaded file is decoded again to check its real pixel size.
import fs from "node:fs";
import { test, expect, setField, setSlider, sliderTo } from "./fixtures.mjs";
import { makePng, pngSize } from "../lib/png.mjs";

const W = 200;
const H = 100;
const PNG = makePng(W, H);

async function upload(page) {
  await page.locator("#fileInput").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("#editorSection")).toBeVisible();
  await expect(page.locator("#uploadSection")).toBeHidden();
}

async function expectSize(page, w, h) {
  await expect(page.locator("#newSize")).toHaveText(`${w} × ${h} px`);
  expect(await page.locator("#canvas").evaluate((c) => [c.width, c.height])).toEqual([w, h]);
  await expect(page.locator("#fileSize")).toHaveText(/^\d+\.\d\d (KB|MB)$/);
}

/** Download the result and decode it in the browser to read its real size and type. */
async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download Resized Image" }).click()]);
  const path = await dl.path();
  const bytes = fs.readFileSync(path);
  const decoded = await page.evaluate(async (b64) => {
    const blob = await (await fetch("data:application/octet-stream;base64," + b64)).blob();
    const bmp = await createImageBitmap(blob);
    return { width: bmp.width, height: bmp.height };
  }, bytes.toString("base64"));
  return { name: dl.suggestedFilename(), bytes, ...decoded };
}

test.describe("Image Resizer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/image-resizer/");
  });

  test("the test image itself is a valid 200 x 100 PNG", () => {
    expect(pngSize(PNG)).toEqual({ width: W, height: H });
  });

  test("clicking the upload box opens the file picker and loads the photo", async ({ page }) => {
    await expect(page.locator("#editorSection")).toBeHidden();
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByText("Click to upload or drag and drop").click()]);
    await chooser.setFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.locator("#editorSection")).toBeVisible();
    await expect(page.locator("#originalSize")).toHaveText(`${W} × ${H} px`);
    await expectSize(page, W, H);
  });

  test("a photo dropped on the upload box loads", async ({ page }) => {
    await page.evaluate(async (b64) => {
      const blob = await (await fetch("data:image/png;base64," + b64)).blob();
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "dropped.png", { type: "image/png" }));
      const target = document.getElementById("uploadSection");
      target.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
      target.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, PNG.toString("base64"));
    await expect(page.locator("#editorSection")).toBeVisible();
    await expect(page.locator("#originalSize")).toHaveText(`${W} × ${H} px`);
  });

  test("percentage: 100% by default, slider at its minimum (10%) and maximum (200%)", async ({ page }) => {
    await upload(page);
    await expect(page.locator("#percentageValue")).toHaveText("100");
    await expectSize(page, W, H);
    await sliderTo(page.locator("#percentage"), "min");
    await expect(page.locator("#percentageValue")).toHaveText("10");
    await expectSize(page, Math.round(W * 0.1), Math.round(H * 0.1));
    await sliderTo(page.locator("#percentage"), "max");
    await expect(page.locator("#percentageValue")).toHaveText("200");
    await expectSize(page, W * 2, H * 2);
    await setSlider(page.locator("#percentage"), 37);
    await expectSize(page, Math.round(W * 0.37), Math.round(H * 0.37));
    const out = await download(page);
    expect(out.name).toBe("resized-image.png");
    expect(pngSize(out.bytes)).toEqual({ width: Math.round(W * 0.37), height: Math.round(H * 0.37) });
  });

  test("custom dimensions keep the aspect ratio, or not when unticked", async ({ page }) => {
    await upload(page);
    await page.locator("#resizeMode").selectOption("dimensions");
    await expect(page.locator("#dimensionsMode")).toBeVisible();
    await expect(page.locator("#percentageMode")).toBeHidden();
    await expect(page.locator("#customWidth")).toHaveValue(String(W));
    await expect(page.locator("#customHeight")).toHaveValue(String(H));
    await expect(page.getByLabel("Maintain aspect ratio")).toBeChecked();

    await setField(page.locator("#customWidth"), "150");
    await expect(page.locator("#customHeight")).toHaveValue("75");
    await expectSize(page, 150, 75);
    await setField(page.locator("#customHeight"), "33");
    await expect(page.locator("#customWidth")).toHaveValue("66");
    await expectSize(page, 66, 33);

    await page.getByLabel("Maintain aspect ratio").uncheck();
    await setField(page.locator("#customWidth"), "300");
    await expect(page.locator("#customHeight")).toHaveValue("33");
    await expectSize(page, 300, 33);
    const out = await download(page);
    expect([out.width, out.height]).toEqual([300, 33]);
  });

  test("every preset size", async ({ page }) => {
    await upload(page);
    await page.locator("#resizeMode").selectOption("preset");
    await expect(page.locator("#presetMode")).toBeVisible();
    for (const [w, h] of [[1920, 1080], [1280, 720], [1024, 768], [800, 600], [640, 480], [512, 512], [256, 256]]) {
      await page.locator("#presetSize").selectOption(`${w},${h}`);
      await expectSize(page, w, h);
    }
    const out = await download(page);
    expect([out.width, out.height]).toEqual([256, 256]);
  });

  test("JPEG and WebP downloads, with the quality slider at its minimum and maximum", async ({ page }) => {
    await upload(page);
    const quality = page.locator("#qualityControl");
    await page.locator("#outputFormat").selectOption("image/jpeg");
    await expect(quality).toBeVisible();
    await sliderTo(page.locator("#quality"), "min");
    await expect(page.locator("#qualityValue")).toHaveText("1");
    let out = await download(page);
    expect(out.name).toBe("resized-image.jpg");
    expect(out.bytes.subarray(0, 2).toString("hex")).toBe("ffd8");
    expect([out.width, out.height]).toEqual([W, H]);
    const low = out.bytes.length;
    await sliderTo(page.locator("#quality"), "max");
    await expect(page.locator("#qualityValue")).toHaveText("100");
    out = await download(page);
    expect(out.bytes.length, "higher quality makes a bigger JPEG").toBeGreaterThan(low);

    await page.locator("#outputFormat").selectOption("image/webp");
    await expect(quality).toBeVisible();
    out = await download(page);
    expect(out.name).toBe("resized-image.webp");
    expect(out.bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect([out.width, out.height]).toEqual([W, H]);

    await page.locator("#outputFormat").selectOption("image/png");
    await expect(quality).toBeHidden();
  });

  test("Upload New Image goes back to the upload box", async ({ page }) => {
    await upload(page);
    await page.getByRole("button", { name: "Upload New Image" }).click();
    await expect(page.locator("#uploadSection")).toBeVisible();
    await expect(page.locator("#editorSection")).toBeHidden();
    await expect(page.locator("#fileInput")).toHaveValue("");
    await upload(page);
    await expect(page.locator("#originalSize")).toHaveText(`${W} × ${H} px`);
  });
});
