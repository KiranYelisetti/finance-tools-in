/*
 * Sukanya Samriddhi (SSY) maths for /ssy-calculator/. No DOM.
 * Works in the browser as QTCalc.ssy and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    var DEPOSIT_YEARS = 15;   // deposits for 15 years from opening
    var MATURITY_YEARS = 21;  // the account matures 21 years from opening

    // Returns null when the age is outside 0 to 10 or the deposit outside 250 to 1,50,000.
    function calculate(currentAge, annualDeposit, ratePct) {
        var interestRate = ratePct / 100;
        if (currentAge < 0 || currentAge > 10) return null;
        if (annualDeposit < 250 || annualDeposit > 150000) return null;

        var balance = 0;
        var totalInvestment = 0;
        var balanceAt18 = 0;

        for (var year = 1; year <= MATURITY_YEARS; year++) {
            if (year <= DEPOSIT_YEARS) {
                balance += annualDeposit;
                totalInvestment += annualDeposit;
            }
            balance += balance * interestRate;
            // The withdrawal at 18 uses the balance at the end of the year before she turns 18. For a part-year
            // age (5.5) that is year 12, for a whole age (5) year 13: the year 18 - age, rounded down.
            if (year === Math.floor(18 - currentAge)) balanceAt18 = balance;
        }

        var taxBenefit = Math.min(annualDeposit, 150000);
        return {
            maturityValue: balance,
            totalInvestment: totalInvestment,
            totalInterest: balance - totalInvestment,
            balanceAt18: balanceAt18,
            partialWithdrawal: balanceAt18 * 0.50,
            taxBenefit: taxBenefit,
            taxSavings: taxBenefit * 0.312, // 30% slab plus 4% cess, old regime only
            depositEndAge: currentAge + DEPOSIT_YEARS,
            maturityAge: currentAge + MATURITY_YEARS
        };
    }

    var api = { calculate: calculate, DEPOSIT_YEARS: DEPOSIT_YEARS, MATURITY_YEARS: MATURITY_YEARS };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).ssy = api;
})(typeof window !== 'undefined' ? window : this);
