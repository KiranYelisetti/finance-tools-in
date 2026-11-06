// Test files made on the fly: real PNGs, JPEGs (with or without an EXIF orientation tag) and PDFs, including a
// password-protected one and a broken one. Nothing is kept on disk.
import zlib from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const PDFLib = require("pdf-lib");

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

/** A w x h PNG in one colour. */
export function png(w, h, [r, g, b] = [200, 30, 30]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** A real w x h JPEG, drawn by the browser on the given page. */
export async function jpeg(page, w, h, color = "#2a6") {
  const b64 = await page.evaluate(({ w, h, color }) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  }, { w, h, color });
  return Buffer.from(b64, "base64");
}

/** The same JPEG with an EXIF APP1 segment that sets the orientation tag (6 = turn a quarter clockwise). */
export function withOrientation(jpg, value) {
  const tiff = Buffer.from([0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, value, 0, 0, 0, 0, 0, 0, 0]);
  const app1 = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const len = Buffer.alloc(2); len.writeUInt16BE(app1.length + 2);
  return Buffer.concat([jpg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, app1, jpg.subarray(2)]);
}

/** A PDF with `pages` pages of the given size in points. */
export async function pdf(pages, size = [300, 400]) {
  const d = await PDFLib.PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage(size);
  return Buffer.from(await d.save());
}

/** A PDF whose trailer points at an encryption dictionary, as a password-protected PDF does. */
export async function encryptedPdf() {
  const d = await PDFLib.PDFDocument.create();
  d.addPage();
  d.context.trailerInfo.Encrypt = d.context.register(d.context.obj({ Filter: "Standard", V: 1, R: 2, P: -44 }));
  return Buffer.from(await d.save({ useObjectStreams: false }));
}

export const brokenPdf = () => Buffer.from("%PDF-1.7\nthis file was cut short\n");

/** Read a downloaded PDF: page count and page sizes rounded to whole points. */
export async function readPdf(bytes) {
  const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
  return { pages: doc.getPageCount(), sizes: doc.getPages().map((p) => { const s = p.getSize(); return [Math.round(s.width), Math.round(s.height)]; }), producer: doc.getProducer() };
}
