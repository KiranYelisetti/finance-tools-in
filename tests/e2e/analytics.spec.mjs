// Google Analytics loads on the live site and never on a local test server. On 6 Nov 2026 local test runs of the
// sister site were counted as 4,600 visitors, so the tag now checks the host, and this test holds it to that.
// Against the live site (BASE_URL) the tag request is still stubbed by the fixtures, so no visit is counted.
import { test, expect } from "./fixtures.mjs";

const TAG = /googletagmanager\.com\/gtag|google-analytics\.com|analytics\.google\.com/;

test("analytics runs on the live site only", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "checked once");
  const hits = [];
  page.on("request", (r) => {
    if (TAG.test(r.url())) hits.push(r.url());
  });
  for (const path of ["/", "/number-to-words/"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  if (/(^|\.)quicktoolsplus\.com$/.test(new URL(baseURL).hostname)) {
    expect(hits.length, "the Google tag loads on the live site").toBeGreaterThan(0);
  } else {
    expect(hits, "no analytics request from a local server").toEqual([]);
  }
});
