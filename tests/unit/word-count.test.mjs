// Unit tests for src/js/calc/word-count.js. Expected counts are worked by hand from the rules in the module header.
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./_helpers.mjs";

const W = load("word-count");

test("words: runs between spaces that hold a letter or digit, like Microsoft Word", () => {
  assert.equal(W.countWords(""), 0);
  assert.equal(W.countWords("   \n\t "), 0);
  assert.equal(W.countWords("The quick brown fox"), 4);
  assert.equal(W.countWords("e.g. 3.5 well-known don't"), 4);
  assert.equal(W.countWords("Wait — what?"), 2); // a lone dash is not a word
  assert.equal(W.countWords("one\ntwo\r\nthree\tfour"), 4);
  assert.equal(W.countWords("₹1,50,000 is the price"), 4);
  assert.equal(W.countWords("नमस्ते दुनिया"), 2); // Hindi uses spaces between words
  assert.equal(W.countWords("日本語"), 3); // each CJK character counts as a word
  assert.equal(W.countWords("😀 🎉"), 0); // emoji alone hold no letter or digit
});

test("characters count what a reader sees, with and without spaces", () => {
  const a = W.analyse("Hi there");
  assert.equal(a.characters, 8);
  assert.equal(a.charactersNoSpaces, 7);
  // A family emoji (several code points joined) and a skin-tone thumb are one character each
  assert.equal(W.analyse("👨‍👩‍👧 👍🏽").characters, 3);
  // Windows line endings count once
  assert.equal(W.analyse("a\r\nb").characters, 3);
});

test("sentences end at . ! ? and the danda when a space, line break or the end follows", () => {
  assert.equal(W.countSentences(""), 0);
  assert.equal(W.countSentences("One. Two! Three? Four"), 4);
  assert.equal(W.countSentences("Version 3.5 is out. Get it."), 2); // no space after the point in 3.5
  assert.equal(W.countSentences("He said \"Stop.\" Then he left."), 2);
  assert.equal(W.countSentences("यह पहला वाक्य है। यह दूसरा है।"), 2);
  assert.equal(W.countSentences("..."), 0);
});

test("paragraphs are non-empty lines", () => {
  assert.equal(W.countParagraphs("First line\nSecond line\n\n\nThird"), 3);
  assert.equal(W.countParagraphs("\n\n  \n"), 0);
});

test("reading and speaking time at the default and a custom pace", () => {
  assert.equal(W.READ_WPM, 238);
  assert.equal(W.SPEAK_WPM, 140);
  assert.equal(W.duration(238, 238).text, "1 min");
  assert.equal(W.duration(357, 238).text, "1 min 30 sec");
  assert.equal(W.duration(0, 238).text, "0 sec");
  assert.equal(W.duration(70, 140).text, "30 sec");
  assert.equal(W.duration(1, 100000).text, "under 1 sec");
  const words = Array.from({ length: 476 }, () => "word").join(" ");
  const a = W.analyse(words, { readWpm: 238, speakWpm: 119 });
  assert.equal(a.reading.text, "2 min");
  assert.equal(a.speaking.text, "4 min");
});

test("most used words: lower-cased, punctuation trimmed, common words optional", () => {
  const t = "The cat sat. The cat ran! A dog, the dog.";
  const all = W.topWords(t, 10, false);
  assert.deepEqual(all.map((x) => [x.word, x.count]), [["the", 3], ["cat", 2], ["dog", 2]]);
  const skip = W.topWords(t, 10, true);
  assert.deepEqual(skip.map((x) => x.word), ["cat", "dog"]);
  assert.equal(all[0].share, 3 / 10);
  assert.deepEqual(W.topWords("once only", 10, false), []); // words used once are not listed
});

test("SMS parts follow GSM 7-bit and UCS-2 rules", () => {
  assert.deepEqual(W.sms(""), { encoding: "GSM-7", units: 0, parts: 0, perPart: 160 });
  assert.equal(W.sms("a".repeat(160)).parts, 1);
  assert.equal(W.sms("a".repeat(161)).parts, 2);
  assert.equal(W.sms("a".repeat(306)).parts, 2);
  assert.equal(W.sms("a".repeat(307)).parts, 3);
  // { takes two units in GSM-7
  assert.equal(W.sms("{".repeat(80)).units, 160);
  assert.equal(W.sms("{".repeat(81)).parts, 2);
  // Hindi or a curly quote switches to Unicode: 70 per message, 67 per part
  const u = W.sms("नमस्ते");
  assert.equal(u.encoding, "Unicode");
  assert.equal(W.sms("’".repeat(70)).parts, 1);
  assert.equal(W.sms("’".repeat(71)).parts, 2);
  assert.equal(W.sms("’".repeat(134)).parts, 2);
  assert.equal(W.sms("’".repeat(135)).parts, 3);
});

test("limits: characters left and over", () => {
  const a = W.analyse("x".repeat(281));
  const x = a.limits.find((l) => l.key === "x");
  assert.equal(x.max, 280);
  assert.equal(x.over, true);
  assert.equal(x.left, -1);
  const yt = a.limits.find((l) => l.key === "youtube");
  assert.equal(yt.max, 100);
  assert.equal(a.limits.find((l) => l.key === "instagram").max, 2200);
});

test("a large text is counted quickly", () => {
  const big = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20000); // about 1.1 MB
  const t0 = Date.now();
  const a = W.analyse(big, { skipCommon: true });
  const ms = Date.now() - t0;
  assert.equal(a.words, 160000);
  assert.equal(a.sentences, 20000);
  assert.ok(ms < 4000, `took ${ms} ms`);
});

// The counter cuts long text into pieces so older engines stay fast (Node 20 hung the deploy on 7 Nov 2026).
// Cutting must never change the count, even in text with no spaces, emoji families, flags and Hindi conjuncts.
test("characters: long text is counted in pieces without changing the count", () => {
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const direct = (s) => { let n = 0; for (const _ of seg.segment(s)) n++; return n; };
  const units = ["क्षत्रि👩‍👩‍👧", "x👩‍👩‍👧", "ab🇮🇳", "कि👍🏽", "éz", "line\n", "नमस्ते दुनिया 👍 hello "];
  for (const u of units) {
    for (const k of [1, 2999, 3001]) {
      const text = u.repeat(k);
      assert.equal(W.graphemes(text), direct(text), `${JSON.stringify(u)} x ${k}`);
    }
  }
  const big = "क्षत्रि👩‍👩‍👧".repeat(70000);
  const t = Date.now();
  W.graphemes(big);
  assert.ok(Date.now() - t < 2000, "a million characters with no spaces in under 2 seconds");
});
