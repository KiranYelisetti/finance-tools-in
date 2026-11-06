// Unit tests for src/js/calc/qr-payload.js. Payload strings are checked exactly, then every payload is turned into a
// real QR code with the vendored qrcode-generator, drawn into pixels and read back with jsQR (a separate decoder).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { load } from "./_helpers.mjs";

const require = createRequire(import.meta.url);
const Q = load("qr-payload");
const qrcode = require("../../src/js/vendor/qrcode-generator-1.4.4.js");
const jsQR = require("jsqr");

qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

/** Make a code, draw it at 4 px a module with a 4 module margin, decode it. Returns the decoded bytes as text. */
function roundTrip(payload, level = "M") {
  const qr = qrcode(0, level);
  qr.addData(payload, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const scale = 4, margin = 4, size = (n + 2 * margin) * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.isDark(r, c)) continue;
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      const i = (((r + margin) * scale + y) * size + (c + margin) * scale + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }
  const out = jsQR(px, size, size);
  assert.ok(out, `decoder read the code for ${JSON.stringify(payload)}`);
  return Buffer.from(out.binaryData).toString("utf8");
}

test("text: kept exactly, empty refused", () => {
  assert.deepEqual(Q.build("text", { text: "Hello" }), { ok: true, payload: "Hello" });
  assert.equal(Q.build("text", { text: "   " }).ok, false);
  assert.equal(Q.build("text", {}).field, "text");
});

test("links: https added when missing, other schemes and bare words refused", () => {
  assert.equal(Q.build("url", { url: "example.com" }).payload, "https://example.com");
  assert.equal(Q.build("url", { url: " https://example.com/a?b=1 " }).payload, "https://example.com/a?b=1");
  assert.equal(Q.build("url", { url: "http://x.in" }).payload, "http://x.in");
  assert.equal(Q.build("url", { url: "javascript:alert(1)" }).ok, false);
  assert.equal(Q.build("url", { url: "hello" }).ok, false);
  assert.equal(Q.build("url", { url: "" }).ok, false);
});

test("Wi-Fi: special characters escaped, open networks have no password", () => {
  assert.equal(Q.build("wifi", { ssid: "Home", security: "WPA", password: "secret123" }).payload, "WIFI:T:WPA;S:Home;P:secret123;;");
  assert.equal(Q.build("wifi", { ssid: 'My;Net,"5G"', security: "WPA", password: 'a:b\\c;d,e"' }).payload,
    'WIFI:T:WPA;S:My\\;Net\\,\\"5G\\";P:a\\:b\\\\c\\;d\\,e\\";;');
  assert.equal(Q.build("wifi", { ssid: "Cafe", security: "nopass", password: "ignored" }).payload, "WIFI:T:nopass;S:Cafe;;");
  assert.equal(Q.build("wifi", { ssid: "Hidden", security: "WPA", password: "12345678", hidden: true }).payload, "WIFI:T:WPA;S:Hidden;P:12345678;H:true;;");
  assert.equal(Q.build("wifi", { ssid: "Home", security: "WPA", password: "short" }).field, "password");
  assert.equal(Q.build("wifi", { ssid: "", security: "WPA", password: "secret123" }).field, "ssid");
  assert.equal(Q.build("wifi", { ssid: "Old", security: "WEP", password: "abc" }).payload, "WIFI:T:WEP;S:Old;P:abc;;");
});

test("phone: digits kept, a leading + kept, letters refused", () => {
  assert.equal(Q.build("phone", { phone: "+91 98765 43210" }).payload, "tel:+919876543210");
  assert.equal(Q.build("phone", { phone: "(022) 2345-6789" }).payload, "tel:02223456789");
  assert.equal(Q.build("phone", { phone: "call me" }).ok, false);
  assert.equal(Q.build("phone", { phone: "12" }).ok, false);
});

test("email: subject and body percent-encoded", () => {
  assert.equal(Q.build("email", { email: "a@b.co" }).payload, "mailto:a@b.co");
  assert.equal(Q.build("email", { email: "a@b.co", subject: "Hi there", body: "Line 1\nLine 2 & more" }).payload,
    "mailto:a@b.co?subject=Hi%20there&body=Line%201%0ALine%202%20%26%20more");
  assert.equal(Q.build("email", { email: "not-an-email" }).ok, false);
});

test("UPI: the NPCI deep link with payee, name, optional amount, INR and note", () => {
  assert.equal(Q.build("upi", { upiId: "shop@okaxis", name: "Ravi Stores" }).payload, "upi://pay?pa=shop@okaxis&pn=Ravi%20Stores&cu=INR");
  assert.equal(Q.build("upi", { upiId: "shop@okaxis", name: "Ravi Stores", amount: "250", note: "Order 42" }).payload,
    "upi://pay?pa=shop@okaxis&pn=Ravi%20Stores&am=250.00&cu=INR&tn=Order%2042");
  assert.equal(Q.build("upi", { upiId: "x.y-z@ybl", name: "A", amount: "1,250.5" }).payload, "upi://pay?pa=x.y-z@ybl&pn=A&am=1250.50&cu=INR");
  assert.equal(Q.build("upi", { upiId: "noatsign", name: "A" }).field, "upiId");
  assert.equal(Q.build("upi", { upiId: "a@b", name: "A" }).field, "upiId"); // the handle after @ needs 2 or more characters
  assert.equal(Q.build("upi", { upiId: "shop@okaxis", name: "" }).field, "name");
  for (const bad of ["0", "-5", "12.345", "abc"]) assert.equal(Q.build("upi", { upiId: "shop@okaxis", name: "A", amount: bad }).field, "amount", bad);
});

test("every payload is a code that a decoder reads back exactly, at every error correction level", () => {
  const payloads = [
    Q.build("text", { text: "Hello, QuickTools Plus" }).payload,
    Q.build("text", { text: "नमस्ते दुनिया 😀" }).payload,
    Q.build("url", { url: "quicktoolsplus.com/word-counter/" }).payload,
    Q.build("wifi", { ssid: 'My;Net,"5G"', security: "WPA", password: 'a:b\\c;d,e"' }).payload,
    Q.build("phone", { phone: "+91 98765 43210" }).payload,
    Q.build("email", { email: "a@b.co", subject: "Hi", body: "Line 1\nLine 2" }).payload,
    Q.build("upi", { upiId: "shop@okaxis", name: "Ravi Stores", amount: "250", note: "Order 42" }).payload,
  ];
  for (const level of ["L", "M", "Q", "H"]) for (const p of payloads) assert.equal(roundTrip(p, level), p, `${level}: ${p}`);
});

test("a long text fits up to the limit of the level and fails clearly beyond it", () => {
  assert.equal(roundTrip("a".repeat(1500), "L"), "a".repeat(1500));
  const qr = qrcode(0, "H");
  qr.addData("a".repeat(3000), "Byte");
  assert.throws(() => qr.make(), /overflow/i);
});

test("the SVG has a white quiet zone and one black square per dark module", () => {
  const svg = Q.toSvg(2, (r, c) => r === c, 4, 100);
  assert.match(svg, /viewBox="0 0 10 10"/);
  assert.match(svg, /width="100" height="100"/);
  assert.match(svg, /<rect width="10" height="10" fill="#ffffff"\/>/);
  assert.equal((svg.match(/h1v1h-1z/g) || []).length, 2);
  assert.match(svg, /M4 4h1v1h-1zM5 5h1v1h-1z/);
});
