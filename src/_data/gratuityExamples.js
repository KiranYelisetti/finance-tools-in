// Worked examples on /gratuity-calculator/. Every figure comes from the tested maths in js/calc/gratuity.js at build
// time, so the table can never disagree with the calculator.
const G = require("../js/calc/gratuity.js");

const inr = (x) => "₹" + Math.round(x).toLocaleString("en-IN");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const CASES = [
    { who: "Permanent", joinDate: "2021-11-01", basicDA: 30000, otherPay: 20000, type: "permanent" },
    { who: "Permanent, large allowances", joinDate: "2019-04-01", basicDA: 20000, otherPay: 40000, type: "permanent" },
    { who: "Permanent, large allowances", joinDate: "2018-06-01", basicDA: 40000, otherPay: 60000, type: "permanent" },
    { who: "Permanent, long service", joinDate: "2006-11-01", basicDA: 100000, otherPay: 50000, type: "permanent" },
    { who: "Permanent, high pay", joinDate: "2011-11-01", basicDA: 250000, otherPay: 100000, type: "permanent" },
    { who: "Fixed-term contract", joinDate: "2025-04-01", basicDA: 26000, otherPay: 14000, type: "fixedTerm", reason: "contractEnd" },
];

module.exports = CASES.map((c) => {
    const r = G.calculate({ reason: "resignation", ...c, lastDay: "2026-10-31" });
    const s = r.service;
    const served = [s.years ? plural(s.years, "year") : "", s.months ? plural(s.months, "month") : ""].filter(Boolean).join(" ");
    return {
        who: c.who,
        basicDA: inr(c.basicDA),
        otherPay: inr(c.otherPay),
        served,
        counted: s.counted,
        wage: inr(r.monthlyWage),
        gratuity: inr(r.payable),
        capped: r.capped,
    };
});
