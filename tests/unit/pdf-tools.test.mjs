// Unit tests for src/js/calc/pdf-tools.js, with the same pdf-lib version the site vendors (1.17.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import zlib from "node:zlib";
import { load, close } from "./_helpers.mjs";

const require = createRequire(import.meta.url);
const P = load("pdf-tools");
const PDFLib = require("pdf-lib");

// A real PNG of w x h pixels in one colour, made with zlib (no image library needed)
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, [r, g, b] = [200, 30, 30]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

// The start of a JPEG with an EXIF orientation tag, in Intel (little-endian) or Motorola (big-endian) byte order
function jpegWithOrientation(value, littleEndian) {
  const u16 = (v) => (littleEndian ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v) => (littleEndian ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const tiff = [...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(value), 0, 0, ...u32(0)];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...app1, 0xff, 0xda, 0, 2]);
}

async function pdfWith(pages, size = [300, 400]) {
  const d = await PDFLib.PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage(size);
  return d.save();
}

test("placement on A4: fitted inside the margins, centred, turned for wide images", () => {
  const p = P.placement(1000, 2000, { size: "a4", orientation: "auto", margin: "small" });
  assert.deepEqual([p.pageW, p.pageH], [595.28, 841.89]);
  close(p.h, 841.89 - 36, 1e-9); // a tall image fills the height inside 18 pt margins
  close(p.w, (841.89 - 36) / 2, 1e-9);
  close(p.x, (595.28 - p.w) / 2, 1e-9);
  const wide = P.placement(3000, 2000, { size: "a4", orientation: "auto", margin: "none" });
  assert.deepEqual([wide.pageW, wide.pageH], [841.89, 595.28]); // landscape page
  close(wide.w, 841.89, 1e-9);
  const forced = P.placement(3000, 2000, { size: "a4", orientation: "portrait", margin: "large" });
  assert.deepEqual([forced.pageW, forced.pageH], [595.28, 841.89]);
  close(forced.w, 595.28 - 72, 1e-9);
});

test("placement on Letter and fit to image", () => {
  const l = P.placement(800, 800, { size: "letter", orientation: "auto", margin: "none" });
  assert.deepEqual([l.pageW, l.pageH], [612, 792]);
  close(l.w, 612, 1e-9);
  close(l.y, (792 - 612) / 2, 1e-9);
  const f = P.placement(960, 480, { size: "fit", margin: "small" });
  close(f.w, 720, 1e-9); // 960 px at 96 px an inch is 10 inches, 720 points
  close(f.pageW, 720 + 36, 1e-9);
  close(f.pageH, 360 + 36, 1e-9);
  assert.throws(() => P.placement(0, 10, {}));
});

test("file types are told apart by their first bytes", () => {
  assert.equal(P.sniff(png(1, 1)), "png");
  assert.equal(P.sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "jpg");
  assert.equal(P.sniff(new TextEncoder().encode("%PDF-1.7\n")), "pdf");
  assert.equal(P.sniff(new TextEncoder().encode("junk\n%PDF-1.4")), "pdf");
  assert.equal(P.sniff(new TextEncoder().encode("hello world")), null);
  assert.equal(P.sniff(new Uint8Array([1])), null);
});

test("EXIF orientation is read in both byte orders, 1 when absent", () => {
  for (const v of [1, 3, 6, 8, 2, 5]) {
    assert.equal(P.exifOrientation(jpegWithOrientation(v, true)), v, `little-endian ${v}`);
    assert.equal(P.exifOrientation(jpegWithOrientation(v, false)), v, `big-endian ${v}`);
  }
  assert.equal(P.exifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2])), 1);
  assert.equal(P.exifOrientation(png(1, 1)), 1);
  assert.equal(P.exifOrientation(jpegWithOrientation(9, true)), 1); // out of range
});

test("images become one page each, in order, with the chosen page size", async () => {
  const bytes = await P.imagesToPdf(PDFLib, [{ bytes: png(400, 300), type: "png" }, { bytes: png(300, 600), type: "png" }], { size: "a4", orientation: "auto", margin: "small" });
  const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
  assert.equal(doc.getPageCount(), 2);
  const [a, b] = doc.getPages().map((p) => p.getSize());
  assert.deepEqual([Math.round(a.width), Math.round(a.height)], [842, 595]); // wide image, landscape page
  assert.deepEqual([Math.round(b.width), Math.round(b.height)], [595, 842]);
  assert.equal(doc.getProducer(), "QuickTools Plus JPG to PDF");
});

test("fifty images make fifty pages", async () => {
  const imgs = Array.from({ length: 50 }, (_, i) => ({ bytes: png(20 + i, 30, [i * 5, 100, 200]), type: "png" }));
  let calls = 0;
  const bytes = await P.imagesToPdf(PDFLib, imgs, { size: "fit", margin: "none" }, () => calls++);
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 50);
  assert.equal(calls, 50);
  close(doc.getPage(49).getSize().width, 69 * 0.75, 1e-6);
});

test("merging keeps every page, in the order given, at its own size", async () => {
  const a = await P.openPdf(PDFLib, await pdfWith(2, [300, 400]));
  const b = await P.openPdf(PDFLib, await pdfWith(3, [500, 200]));
  assert.equal(a.pages, 2);
  assert.equal(b.pages, 3);
  const merged = await PDFLib.PDFDocument.load(await P.mergeDocs(PDFLib, [b.doc, a.doc]));
  assert.equal(merged.getPageCount(), 5);
  assert.deepEqual(merged.getPages().map((p) => p.getSize().width), [500, 500, 500, 300, 300]);
});

test("password-protected, broken, empty and non-PDF files are named, not crashed on", async () => {
  const d = await PDFLib.PDFDocument.create();
  d.addPage();
  // A classic trailer that points at an encryption dictionary, as a password-protected PDF has
  d.context.trailerInfo.Encrypt = d.context.register(d.context.obj({ Filter: "Standard", V: 1, R: 2, P: -44 }));
  const encrypted = await d.save({ useObjectStreams: false });
  assert.deepEqual(await P.openPdf(PDFLib, encrypted), { ok: false, kind: "encrypted" });
  assert.deepEqual(await P.openPdf(PDFLib, new TextEncoder().encode("%PDF-1.7\nthis is not a real pdf\n%%EOF")), { ok: false, kind: "broken" });
  assert.deepEqual(await P.openPdf(PDFLib, png(2, 2)), { ok: false, kind: "not-pdf" });
  const empty = await (await PDFLib.PDFDocument.create()).save({ addDefaultPage: false }); // pdf-lib adds a page unless told not to
  assert.deepEqual(await P.openPdf(PDFLib, empty), { ok: false, kind: "empty" });
});

test("move reorders without changing the original list", () => {
  const list = ["a", "b", "c", "d"];
  assert.deepEqual(P.move(list, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(P.move(list, 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(P.move(list, 1, 9), list);
  assert.deepEqual(list, ["a", "b", "c", "d"]);
});
