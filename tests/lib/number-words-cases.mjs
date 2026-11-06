// Cases for the Number to Words engine (src/js/number-words.js). One list, used twice:
// scripts/test-number-words.mjs runs them against the module (npm test), and
// tests/e2e/number-to-words.spec.mjs types them into the real page.
// Expected values are worked out by hand. Many inputs are real Search Console queries for /number-to-words/.

export const cases = [
  // Plain amounts (the old behaviour must not change)
  ["1500000", {
    rupees: "1500000", indianGrouped: "15,00,000", indianFormat: "15 Lakh", inWords: "Fifteen Lakh Rupees Only",
    cheque: "Rupees Fifteen Lakh Only", internationalGrouped: "1,500,000", internationalFormat: "1 Million 500 Thousand",
    internationalWords: "One Million Five Hundred Thousand", hasUnits: false, digitCount: 7, zeroCount: 5,
  }],
  ["15,00,000", { rupees: "1500000" }],
  ["₹15,00,000", { rupees: "1500000" }],
  ["Rs. 1500", { rupees: "1500" }],
  ["1500 rupees only", { rupees: "1500" }],
  ["1500.50", {
    rupees: "1500", paise: 50, indianGrouped: "1,500.50", inWords: "One Thousand Five Hundred Rupees and Fifty Paise Only",
    cheque: "Rupees One Thousand Five Hundred and Fifty Paise Only", internationalWords: "One Thousand Five Hundred Point Five Zero",
  }],
  ["1.999", { rupees: "2", paise: 0 }],
  ["1250.75", { inWords: "One Thousand Two Hundred Fifty Rupees and Seventy Five Paise Only" }],
  ["0", { inWords: "Zero Rupees Only", zeroCount: 0 }],
  ["999999999", { inWords: "Ninety Nine Crore Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine Rupees Only" }],
  ["99999999999", { indianFormat: "9,999 Crore 99 Lakh 99 Thousand 999", indianGrouped: "99,99,99,99,999" }],

  // Amounts written with units (new)
  ["1.5 crore", {
    rupees: "15000000", hasUnits: true, indianGrouped: "1,50,00,000", indianFormat: "1 Crore 50 Lakh",
    inWords: "One Crore Fifty Lakh Rupees Only", internationalFormat: "15 Million", digitCount: 8, zeroCount: 6,
  }],
  ["1.5cr", { rupees: "15000000" }],
  ["1.5 Cr in number", { rupees: "15000000" }],
  ["1 cr 30 lakh", { rupees: "13000000", indianFormat: "1 Crore 30 Lakh", inWords: "One Crore Thirty Lakh Rupees Only" }],
  ["15lakh in words", { rupees: "1500000", inWords: "Fifteen Lakh Rupees Only" }],
  ["15 lakhs in words", { rupees: "1500000" }],
  ["15 lac", { rupees: "1500000" }],
  ["270 lakh crore in numbers", {
    rupees: "270000000000000", indianGrouped: "27,00,00,00,00,00,000", indianFormat: "270 Lakh Crore",
    inWords: "Two Hundred Seventy Lakh Crore Rupees Only", internationalFormat: "270 Trillion",
    internationalWords: "Two Hundred Seventy Trillion", digitCount: 15, zeroCount: 13,
  }],
  ["99 lakh crore", { rupees: "99000000000000", indianFormat: "99 Lakh Crore", internationalFormat: "99 Trillion" }],
  ["lakh crore", { rupees: "1000000000000", indianGrouped: "10,00,00,00,00,000", inWords: "One Lakh Crore Rupees Only", internationalWords: "One Trillion" }],
  ["crore", { rupees: "10000000" }],
  ["15 hazar crore", {
    rupees: "150000000000", indianFormat: "15,000 Crore", inWords: "Fifteen Thousand Crore Rupees Only",
    internationalWords: "One Hundred Fifty Billion",
  }],
  ["6 arab", { rupees: "6000000000", indianFormat: "600 Crore", inWords: "Six Hundred Crore Rupees Only", internationalWords: "Six Billion" }],
  ["2 kharab", { rupees: "200000000000" }],
  ["2.5 million", { rupees: "2500000", indianFormat: "25 Lakh", inWords: "Twenty Five Lakh Rupees Only" }],
  ["1 billion", { rupees: "1000000000", indianFormat: "100 Crore" }],
  ["3 trillion", { rupees: "3000000000000", indianFormat: "3 Lakh Crore" }],
  ["15k", { rupees: "15000" }],
  ["2 lakh 50 thousand crore", {
    rupees: "2500000000000", indianFormat: "2 Lakh 50,000 Crore", inWords: "Two Lakh Fifty Thousand Crore Rupees Only",
    internationalWords: "Two Trillion Five Hundred Billion",
  }],
  ["5 lakh crore 30 thousand crore", { rupees: "5300000000000", indianFormat: "5 Lakh 30,000 Crore" }],
  ["15 lakh 50 thousand 500", { rupees: "1550500" }],
  ["1.23456789 crore", { rupees: "12345678", paise: 90 }],
  ["0.009 crore in rupees", { rupees: "90000" }],

  // Number words
  ["twenty five lakh", { rupees: "2500000" }],
  ["one crore", { rupees: "10000000" }],
  ["two hundred seventy lakh crore", { rupees: "270000000000000" }],
  ["what is a crore", { rupees: "10000000" }],
  ["how many zeros in 1 crore", { rupees: "10000000", zeroCount: 7 }],

  // "in lakhs" names the target, it does not multiply
  ["3500000 in words in lakhs", { rupees: "3500000", indianFormat: "35 Lakh", inWords: "Thirty Five Lakh Rupees Only" }],
  ["1500000 in words lakhs", { rupees: "1500000" }],
  ["convert 1 crore to lakhs", { rupees: "10000000" }],
  ["110000 lakh in words", { rupees: "11000000000", indianFormat: "1,100 Crore" }],

  // Limits
  ["99999 lakh crore", { indianFormat: "99,999 Lakh Crore", inWords: "Ninety Nine Thousand Nine Hundred Ninety Nine Lakh Crore Rupees Only" }],
];

// Inputs that must give an error message
export const errorCases = ["100000 lakh crore", "abc", "15 50", "1 crore in 5"];

// inUnit(rupees, exponent), used by the lakh crore table: [rupees, exponent, expected]
export const inUnitCases = [
  ["9800000000000", 12, "9.8"], ["9800000000000", 7, "980000"], ["270000000000000", 12, "270"],
  ["1000000000000", 9, "1000"], ["150000", 5, "1.5"], ["12345", 3, "12.345"], ["0", 7, "0"],
];
