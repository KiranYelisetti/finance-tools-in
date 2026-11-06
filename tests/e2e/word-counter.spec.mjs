// Word Counter (/word-counter/). Counts are checked against the module's own rules (tests/unit/word-count.test.mjs
// covers the rules in detail). Here: the page updates live, handles empty and very large text, and keeps the text private.
import { test, expect, expectNoBadNumbers, typeInto, setField } from "./fixtures.mjs";

const URL_ = "/word-counter/";

test.describe("Word Counter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/word-counter/");
  });

  test("starts empty with every count at zero", async ({ page }) => {
    await expect(page.locator("#text")).toHaveValue("");
    for (const id of ["words", "characters", "charactersNoSpaces", "sentences", "paragraphs"]) {
      await expect(page.locator("#" + id)).toHaveText("0");
    }
    await expect(page.locator("#readingTime")).toHaveText("0 sec");
    await expect(page.locator("#smsInfo")).toHaveText("0 messages");
    await expect(page.locator("#topWrap")).toBeHidden();
    await expectNoBadNumbers(page);
  });

  test("counts update as you type", async ({ page }) => {
    await typeInto(page.locator("#text"), "Ship it today. Fix it tomorrow!");
    await expect(page.locator("#words")).toHaveText("6");
    await expect(page.locator("#characters")).toHaveText("31");
    await expect(page.locator("#charactersNoSpaces")).toHaveText("26");
    await expect(page.locator("#sentences")).toHaveText("2");
    await expect(page.locator("#paragraphs")).toHaveText("1");
    await expect(page.locator("#smsInfo")).toHaveText("1 message, standard text, 160 characters per message");
    await expect(page.locator("#limit-x")).toHaveText("31 of 280, 249 left");
  });

  test("lines become paragraphs and the most used words are listed", async ({ page }) => {
    await setField(page.locator("#text"), "The cat sat on the mat.\nThe cat ran.\n\nA dog barked at the cat.");
    await expect(page.locator("#paragraphs")).toHaveText("3");
    await expect(page.locator("#sentences")).toHaveText("3");
    // Common words left out by default: cat is the top word
    await expect(page.locator("#topWords tr").first()).toContainText("cat");
    await expect(page.locator("#topWords tr").first()).toContainText("3");
    await page.locator("#skipCommon").uncheck();
    await expect(page.locator("#topWords tr").first()).toContainText("the");
    await expect(page.locator("#topWords tr").first()).toContainText("4");
  });

  test("reading and speaking speed can be changed", async ({ page }) => {
    await setField(page.locator("#text"), Array.from({ length: 476 }, () => "word").join(" "));
    await expect(page.locator("#readingTime")).toHaveText("2 min");
    await expect(page.locator("#speakingTime")).toHaveText("3 min 24 sec"); // 476 / 140 = 3.4 minutes
    await setField(page.locator("#speakWpm"), "119");
    await expect(page.locator("#speakingTime")).toHaveText("4 min");
    await setField(page.locator("#readWpm"), "476");
    await expect(page.locator("#readingTime")).toHaveText("1 min");
    // A blank or silly speed falls back to the default instead of dividing by zero
    await setField(page.locator("#readWpm"), "");
    await expect(page.locator("#readingTime")).toHaveText("2 min");
    await setField(page.locator("#readWpm"), "0");
    await expect(page.locator("#readingTime")).toHaveText("2 min");
    await expectNoBadNumbers(page);
  });

  test("Hindi switches the SMS to Unicode and words still count", async ({ page }) => {
    await setField(page.locator("#text"), "नमस्ते दुनिया। आप कैसे हैं?");
    await expect(page.locator("#words")).toHaveText("5");
    await expect(page.locator("#sentences")).toHaveText("2");
    await expect(page.locator("#smsInfo")).toContainText("Unicode, 70 characters per message");
  });

  test("going over a limit says by how much", async ({ page }) => {
    await setField(page.locator("#text"), "a".repeat(300));
    await expect(page.locator("#limit-x")).toHaveText("300 of 280, 20 over");
    await expect(page.locator("#limit-youtube")).toHaveText("300 of 100, 200 over");
    await expect(page.locator("#limit-instagram")).toHaveText("300 of 2,200, 1,900 left");
    await expect(page.locator("#smsInfo")).toHaveText("2 messages, standard text, 153 characters per part");
  });

  test("a very large paste is counted without freezing the page", async ({ page }) => {
    const big = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20000);
    await setField(page.locator("#text"), big);
    await expect(page.locator("#words")).toHaveText("1,60,000", { timeout: 10000 });
    await expect(page.locator("#sentences")).toHaveText("20,000");
    await expect(page.locator("#characters")).toHaveText((big.length).toLocaleString("en-IN"));
  });

  test("Clear empties the box and the counts", async ({ page }) => {
    await setField(page.locator("#text"), "Some words here");
    await expect(page.locator("#words")).toHaveText("3");
    await page.getByRole("button", { name: "Clear the text" }).click();
    await expect(page.locator("#text")).toHaveValue("");
    await expect(page.locator("#words")).toHaveText("0");
    await expect(page.locator("#topWrap")).toBeHidden();
  });

  test("Copy the counts puts a summary on the clipboard", async ({ page }) => {
    await setField(page.locator("#text"), "One two three. Four.");
    await expect(page.locator("#words")).toHaveText("4");
    await page.getByRole("button", { name: "Copy the counts" }).click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("Words: 4");
    expect(clip).toContain("Sentences: 2");
  });

  test("speeds are remembered, the text is not", async ({ page }) => {
    await setField(page.locator("#text"), "private draft text");
    await setField(page.locator("#readWpm"), "300");
    await page.locator("#skipCommon").uncheck();
    await page.reload();
    await expect(page.locator("#text")).toHaveValue("");
    await expect(page.locator("#readWpm")).toHaveValue("300");
    await expect(page.locator("#skipCommon")).not.toBeChecked();
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    expect(stored).not.toContain("private draft text");
  });

  test(`${URL_} sends no text to analytics`, async ({ page }) => {
    const sent = [];
    page.on("request", (r) => { if (/google|doubleclick/.test(r.url())) sent.push(r.url() + " " + (r.postData() || "")); });
    await setField(page.locator("#text"), "secretphrase123 should never leave");
    await expect(page.locator("#words")).toHaveText("4");
    expect(sent.filter((s) => s.includes("secretphrase123"))).toEqual([]);
  });
});
