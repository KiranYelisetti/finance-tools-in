/*
 * EMI prepayment maths for /emi-prepayment-calculator/. No DOM.
 * Works in the browser as QTCalc.emiPrepayment and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    // The EMI stays as it was. A lump sum is paid at once, before the first EMI, and a monthly extra is paid
    // with every EMI. Returns null when the loan, rate or tenure is not above zero.
    function calculate(o) {
        var P = o.principal;
        var monthlyExtra = o.monthlyExtra || 0;
        var lumpSum = o.lumpSum || 0;
        var r = o.annualRate / 12 / 100;
        var n = o.tenureYears * 12;

        if (P <= 0 || r <= 0 || n <= 0) return null;

        var emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        var origTotalPaid = emi * n;
        var origTotalInterest = origTotalPaid - P;

        var month = 0;
        var totalPaidWithPrepay = 0;
        var totalInterestWithPrepay = 0;

        if (monthlyExtra === 0 && lumpSum === 0) {
            month = n;
            totalPaidWithPrepay = origTotalPaid;
            totalInterestWithPrepay = origTotalInterest;
        } else {
            // The lump sum is applied at once. Only what was owed counts: a lump sum above the loan closes it, no more.
            var lumpUsed = Math.min(lumpSum, P);
            var balance = P - lumpUsed;
            totalPaidWithPrepay = lumpUsed;

            while (balance > 0 && month < n * 2) { // safety limit
                month++;
                var interestThisMonth = balance * r;
                var principalThisMonth = emi - interestThisMonth + monthlyExtra;

                if (principalThisMonth > balance) {
                    // Last month: pay only what is left
                    totalPaidWithPrepay += balance + interestThisMonth;
                    totalInterestWithPrepay += interestThisMonth;
                    balance = 0;
                } else {
                    balance -= principalThisMonth;
                    totalPaidWithPrepay += emi + monthlyExtra;
                    totalInterestWithPrepay += interestThisMonth;
                }
            }
        }

        return {
            emi: emi,
            tenureMonths: n,
            origTotalPaid: origTotalPaid,
            origTotalInterest: origTotalInterest,
            months: month,
            totalPaidWithPrepay: totalPaidWithPrepay,
            totalInterestWithPrepay: totalInterestWithPrepay,
            monthsSaved: Math.max(0, n - month),
            interestSaved: Math.max(0, origTotalInterest - totalInterestWithPrepay),
            totalSaved: Math.max(0, origTotalPaid - totalPaidWithPrepay)
        };
    }

    // "6 years 4 months", "1 year", "0 months"
    function durationText(months) {
        var years = Math.floor(months / 12);
        var rest = months % 12;
        var text = '';
        if (years > 0) text += years + ' year' + (years > 1 ? 's' : '');
        if (rest > 0) text += (text ? ' ' : '') + rest + ' month' + (rest > 1 ? 's' : '');
        return text || '0 months';
    }

    var api = { calculate: calculate, durationText: durationText };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).emiPrepayment = api;
})(typeof window !== 'undefined' ? window : this);
