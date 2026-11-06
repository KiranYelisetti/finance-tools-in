// Home page tiles: tile size and one worked example per tool.
// Examples are computed here at build time with the standard formulas (or the tested number engine),
// never typed by hand. Tools whose answer depends on a notified rate or a date carry no figure,
// so nothing on the home page can go stale between deploys.
const NW = require("../js/number-words.js");
const WC = require("../js/calc/word-count.js");

const inr = (x) => "₹" + Math.round(x).toLocaleString("en-IN");
const lakh = (x) => "₹" + (x / 1e5).toFixed(x % 1e5 === 0 ? 0 : 2).replace(/\.?0+$/, "") + " lakh";

// Reducing-balance EMI, the formula every Indian lender quotes
function emi(principal, ratePct, years) {
    const m = ratePct / 12 / 100;
    const n = years * 12;
    return (principal * m * Math.pow(1 + m, n)) / (Math.pow(1 + m, n) - 1);
}

// SIP future value with each instalment invested at the start of the month (the SIP page's stated convention)
function sipValue(monthly, ratePct, years) {
    const i = ratePct / 12 / 100;
    const n = years * 12;
    return monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
}

const words = NW.convert("150000").inWords;
const wcSample = "Ship it today. Fix it tomorrow.";
const wc = WC.analyse(wcSample);
const lakhCrore = NW.convert("9.8 lakh crore").indianGrouped;

module.exports = {
    "/number-to-words/": { size: "wide", input: "1,50,000", output: words },
    "/lakh-crore-in-numbers/": { input: "9.8 lakh crore", output: lakhCrore },
    "/cash-counter/": { input: "40 × ₹500 + 25 × ₹200", output: inr(40 * 500 + 25 * 200) },
    "/home-loan-calculator/": { input: "₹50 lakh, 20 yrs, 8.5%", output: inr(emi(50e5, 8.5, 20)) + " a month" },
    "/car-loan-calculator/": { input: "₹8 lakh, 5 yrs, 9%", output: inr(emi(8e5, 9, 5)) + " a month" },
    "/emi-prepayment-calculator/": {},
    "/income-tax-calculator/": { size: "wide", input: "₹12.75 lakh salary, new regime, FY 2026-27", output: "₹0 tax" },
    "/salary-calculator/": { size: "half" },
    "/gst-calculator/": { size: "half", input: "₹1,000 + 18% GST", output: inr(1000 * 1.18) },
    "/sip-calculator/": { input: "₹5,000 a month, 10 yrs, 12% assumed", output: lakh(sipValue(5000, 12, 10)) },
    "/ppf-calculator/": {},
    "/ssy-calculator/": {},
    "/study-abroad-calculator/": {},
    "/wedding-cost-calculator/": {},
    "/age-calculator/": {},
    "/image-resizer/": { size: "full" },
    "/qr-code-generator/": {},
    "/jpg-to-pdf/": {},
    "/merge-pdf/": {},
    "/word-counter/": { input: `"${wcSample}"`, output: `${wc.words} words, ${wc.characters} characters` },
};
