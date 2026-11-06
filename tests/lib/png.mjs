// Makes a real PNG file in memory, so the image resizer can be tested without fixture files.
// PNG layout (W3C PNG spec): 8-byte signature, then IHDR, IDAT (zlib-compressed scanlines), IEND chunks.
import zlib from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** An opaque RGBA PNG of the given size with a colour gradient (so encoders cannot shrink it to nothing). */
export function makePng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4); // filter byte 0, then pixels
    for (let x = 0; x < width; x++) {
      row[1 + x * 4] = (x * 255) / Math.max(1, width - 1);
      row[2 + x * 4] = (y * 255) / Math.max(1, height - 1);
      row[3 + x * 4] = 128;
      row[4 + x * 4] = 255;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
