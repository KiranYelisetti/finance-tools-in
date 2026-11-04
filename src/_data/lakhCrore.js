// Rows for /lakh-crore-in-numbers/. Every figure comes from src/js/number-words.js (tested by npm test),
// so nothing on the page is typed by hand. The values are the ones people search for most (Search Console,
// 90 days to 2026-11-02), plus round numbers.
const NW = require("../js/number-words.js");

const VALUES = ["1", "1.44", "1.5", "2", "3.59", "5", "7.5", "9.08", "9.8", "10", "12", "15", "20", "30", "50", "99",
  "100", "123", "200", "205", "214", "270", "285", "300", "350", "500", "600", "999"];

function row(v) {
  const r = NW.convert(`${v} lakh crore`);
  return {
    value: v,
    query: encodeURIComponent(`${v} lakh crore`),
    crore: NW.groupIndian(BigInt(NW.inUnit(r.rupees, 7))),
    indian: r.indianGrouped,
    international: r.internationalGrouped,
    trillion: NW.inUnit(r.rupees, 12),
    billion: NW.groupInternational(BigInt(NW.inUnit(r.rupees, 9).split(".")[0])) + (NW.inUnit(r.rupees, 9).includes(".") ? "." + NW.inUnit(r.rupees, 9).split(".")[1] : ""),
    words: r.inWords.replace(/ Rupees Only$/, ""),
    digits: r.digitCount,
    zeros: r.zeroCount,
  };
}

const rows = VALUES.map(row);
const by = Object.fromEntries(rows.map((x) => [x.value, x]));

// Per person: 205 lakh crore shared by 140 crore people
const total = NW.convert("205 lakh crore").rupees;
const people = NW.convert("140 crore").rupees;
const paise = (total * 10000n) / people; // rupees x 100, plus two more digits for rounding
const rounded = (paise + 50n) / 100n; // whole paise, half up
const perPerson = `${NW.groupIndian(rounded / 100n)}.${String(rounded % 100n).padStart(2, "0")}`;

// Gap between two figures that look alike: 9.8 and 9.08 lakh crore, in crore
const gap = NW.convert("9.8 lakh crore").rupees - NW.convert("9.08 lakh crore").rupees;
const gap908 = NW.groupIndian(gap / 10000000n);

module.exports = { rows, by, perPerson, gap908 };
