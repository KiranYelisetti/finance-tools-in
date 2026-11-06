/*
 * PPF maths for /ppf-calculator/. No DOM.
 * Works in the browser as QTCalc.ppf and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    var MIN_DEPOSIT = 500;
    var MAX_DEPOSIT = 150000;
    var MIN_YEARS = 15;

    // Year by year: add the year's deposit, then a year's interest, compounded yearly.
    // Returns null when the deposit is outside 500 to 1,50,000, the period is under 15 years, or a figure is missing.
    function calculate(annualContribution, years, ratePct) {
        var interestRate = ratePct / 100;
        if (annualContribution < MIN_DEPOSIT || annualContribution > MAX_DEPOSIT) return null;
        if (years < MIN_YEARS) return null;
        if (!annualContribution || !years || !interestRate) return null;

        var balance = 0;
        var totalContribution = 0;
        var balanceAfter7Years = 0;
        var balanceAfter4Years = 0;

        for (var year = 1; year <= years; year++) {
            balance += annualContribution;
            totalContribution += annualContribution;
            balance += balance * interestRate;
            if (year === 4) balanceAfter4Years = balance;
            if (year === 7) balanceAfter7Years = balance;
        }

        var taxBenefit = Math.min(annualContribution, MAX_DEPOSIT);
        return {
            interestRate: interestRate,
            maturityValue: balance,
            totalContribution: totalContribution,
            totalInterest: balance - totalContribution,
            balanceAfter7Years: balanceAfter7Years,
            // PPF Scheme, 2019, para 9(1): from year 8, up to 50% of the lower of the balance at the end of the 4th
            // year before and the balance at the end of the year before. In year 8 that is year 4 against year 7.
            partialWithdrawal: 0.50 * Math.min(balanceAfter4Years, balanceAfter7Years),
            taxBenefit: taxBenefit,
            // 30% slab plus the 4% health and education cess = 31.2% (old regime only, section 123)
            taxSavings: taxBenefit * 0.312
        };
    }

    var api = { calculate: calculate, MIN_DEPOSIT: MIN_DEPOSIT, MAX_DEPOSIT: MAX_DEPOSIT, MIN_YEARS: MIN_YEARS };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).ppf = api;
})(typeof window !== 'undefined' ? window : this);
