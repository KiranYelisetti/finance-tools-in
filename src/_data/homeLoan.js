// Figures quoted on the home loan page, worked out with the same EMI formula the calculator uses,
// so the table and the examples can never drift from the tool. Nothing here is typed by hand.
const inr = (x) => Math.round(x).toLocaleString("en-IN");

function emi(principal, ratePct, years) {
    const m = ratePct / 12 / 100;
    const n = years * 12;
    return (principal * m * Math.pow(1 + m, n)) / (Math.pow(1 + m, n) - 1);
}

// Month-by-month schedule with an optional yearly prepayment at the end of each loan year from `startYear`
function schedule(principal, ratePct, years, prepay = 0, startYear = 1) {
    const m = ratePct / 12 / 100;
    const e = emi(principal, ratePct, years);
    let bal = principal;
    let month = 0;
    let interest = 0;
    while (bal > 0.005 && month < years * 12) {
        const i = bal * m;
        interest += i;
        bal -= e - i;
        if (prepay && month + 1 >= startYear * 12 && (month + 1) % 12 === 0) bal -= prepay;
        month++;
        if (bal < 0) bal = 0;
    }
    return { emi: e, interest, months: month };
}

const short = (x) => (x >= 1e7 ? (x / 1e7).toFixed(2) + " crore" : (x / 1e5).toFixed(2) + " lakh");

const TABLE_RATE = 8.5;
const amounts = [20e5, 30e5, 40e5, 50e5, 75e5, 1e7];
const tenures = [15, 20, 25, 30];

const examples = [
    { principal: 50e5, rate: 8.6, years: 20, prepay: 1e5, startYear: 3 },
    { principal: 1e7, rate: 8.75, years: 25 },
    { principal: 35e5, rate: 8.4, years: 15 },
].map((x) => {
    const plain = schedule(x.principal, x.rate, x.years);
    const out = {
        amount: x.principal >= 1e7 ? x.principal / 1e7 + " crore" : x.principal / 1e5 + " lakh",
        rate: x.rate,
        years: x.years,
        emi: inr(plain.emi),
        interest: inr(plain.interest),
        interestShort: short(plain.interest),
    };
    if (x.prepay) {
        const pre = schedule(x.principal, x.rate, x.years, x.prepay, x.startYear);
        out.prepay = inr(x.prepay);
        out.startYear = x.startYear;
        out.saved = inr(plain.interest - pre.interest);
        out.savedShort = short(plain.interest - pre.interest);
        out.yearsEarly = ((x.years * 12 - pre.months) / 12).toFixed(1);
    }
    return out;
});

module.exports = {
    rate: TABLE_RATE,
    tenures,
    rows: amounts.map((a) => ({
        label: a >= 1e7 ? "₹" + a / 1e7 + " crore" : "₹" + a / 1e5 + " lakh",
        emis: tenures.map((t) => inr(emi(a, TABLE_RATE, t))),
    })),
    examples,
};
