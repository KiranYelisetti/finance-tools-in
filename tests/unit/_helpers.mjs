// Shared helpers for the unit tests (node --test). Not a test file itself: the runner only picks up *.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Load a calculator module from src/js/calc the way Node users will: require(). */
export const load = (name) => require(`../../src/js/calc/${name}.js`);

/** Equal within `tol` (default a millionth of a rupee). */
export function close(actual, expected, tol = 1e-6, message = "") {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tol,
    `${message ? message + ": " : ""}expected ${expected} (within ${tol}), got ${actual}`,
  );
}

/**
 * A test for a known bug: it states what the right answer is, and passes while the code still gets it wrong.
 * When the bug is fixed the test fails with "no longer reproduces", so the marker gets removed and the test
 * becomes a normal one. Same idea as Playwright's test.fail().
 */
export function knownBug(name, reason, fn) {
  test(`${name} [known bug]`, async () => {
    let failed = false;
    try {
      await fn();
    } catch (e) {
      // Only a failed assertion counts as the bug. Anything else (a typo, a missing function) is a broken test.
      if (e && e.code === "ERR_ASSERTION") failed = true;
      else throw e;
    }
    if (!failed) assert.fail(`Known bug no longer reproduces, remove the knownBug marker. Was: ${reason}`);
  });
}
