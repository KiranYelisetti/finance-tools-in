/*
 * Home loan maths for /home-loan-calculator/ and the figures in src/_data/homeLoan.js. No DOM.
 * The same sums the page's inline script and the data file use today, in one place.
 * Works in the browser as QTCalc.homeLoan and in Node via require(). Tested by tests/unit/home-loan.test.mjs.
 */
(function (root) {
    'use strict';

    var INTEREST_CAP = 200000;  // interest on a home you live in, Income-tax Act 2025 s.22(2) (old 24(b))
    var PRINCIPAL_CAP = 150000; // principal inside the s.123 limit (old 80C)

    // Reducing-balance EMI. At 0% the EMI is simply principal / months.
    function emi(principal, annualRatePct, months) {
        var m = annualRatePct / 12 / 100;
        if (m === 0) return principal / months;
        return (principal * m * Math.pow(1 + m, months)) / (Math.pow(1 + m, months) - 1);
    }

    // Month-by-month schedule. With `prepay` > 0, that amount is paid at the end of every loan year from
    // `startYear` (after the 12th, 24th ... EMI). Stops when the balance is cleared or the tenure ends.
    function schedule(principal, annualRatePct, years, prepay, startYear) {
        prepay = prepay || 0;
        startYear = startYear || 1;
        var m = annualRatePct / 12 / 100;
        var tenureMonths = Math.round(years * 12);
        var e = emi(principal, annualRatePct, tenureMonths);
        var bal = principal;
        var month = 0;
        var interest = 0;
        while (bal > 0.005 && month < tenureMonths) {
            var i = bal * m;
            interest += i;
            bal -= e - i;
            if (prepay && month + 1 >= startYear * 12 && (month + 1) % 12 === 0) bal -= prepay;
            month++;
            if (bal < 0) bal = 0;
        }
        return { emi: e, interest: interest, months: month };
    }

    // Everything the page's result panel shows. Returns null unless amount, rate and tenure are all above zero.
    function summary(principal, annualRatePct, years) {
        if (!(principal > 0 && annualRatePct > 0 && years > 0)) return null;
        var tenureMonths = Math.round(years * 12);
        var e = emi(principal, annualRatePct, tenureMonths);
        var totalAmount = e * tenureMonths;
        var principalShare = Math.round((principal / totalAmount) * 100);
        return {
            tenureMonths: tenureMonths,
            emi: e,
            totalAmount: totalAmount,
            totalInterest: totalAmount - principal,
            principalShare: principalShare,
            interestShare: 100 - principalShare,
            emiPerLakh: e / (principal / 100000)
        };
    }

    // What a yearly prepayment does: interest saved, months taken, years saved.
    function withYearlyPrepayment(principal, annualRatePct, years, prepay, startYear) {
        var plain = summary(principal, annualRatePct, years);
        if (!plain) return null;
        var s = schedule(principal, annualRatePct, years, prepay, startYear);
        return {
            interestPaid: s.interest,
            interestSaved: Math.max(0, plain.totalInterest - s.interest),
            months: s.months,
            yearsSaved: (plain.tenureMonths - s.months) / 12
        };
    }

    // First year's interest and principal from the schedule, and the old-regime deductions they allow.
    function yearOneDeductions(principal, annualRatePct, years) {
        var m = annualRatePct / 12 / 100;
        var tenureMonths = Math.round(years * 12);
        var e = emi(principal, annualRatePct, tenureMonths);
        var bal = principal;
        var yearInterest = 0;
        var yearPrincipal = 0;
        for (var k = 0; k < Math.min(12, tenureMonths); k++) {
            var i = bal * m;
            yearInterest += i;
            yearPrincipal += e - i;
            bal -= e - i;
        }
        var interestDeduction = Math.min(INTEREST_CAP, yearInterest);
        var principalDeduction = Math.min(PRINCIPAL_CAP, yearPrincipal);
        return {
            yearInterest: yearInterest,
            yearPrincipal: yearPrincipal,
            interestDeduction: interestDeduction,
            principalDeduction: principalDeduction,
            totalDeduction: interestDeduction + principalDeduction
        };
    }

    var api = {
        emi: emi, schedule: schedule, summary: summary, withYearlyPrepayment: withYearlyPrepayment,
        yearOneDeductions: yearOneDeductions, INTEREST_CAP: INTEREST_CAP, PRINCIPAL_CAP: PRINCIPAL_CAP
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).homeLoan = api;
})(typeof window !== 'undefined' ? window : this);
