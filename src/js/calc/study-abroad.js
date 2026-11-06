/*
 * Study abroad cost maths for /study-abroad-calculator/. No DOM.
 * Works in the browser as QTCalc.studyAbroad and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    // Rupees per unit of each currency: SBI forex card TT selling rates, 6 Nov 2026, 2:09 pm IST
    // (the rate a family pays to send fees abroad). Refresh with the page's "rates as of" note.
    var EXCHANGE_RATES = { USD: 94.45, GBP: 127.41, EUR: 106.50, AUD: 65.77, CAD: 67.63 };
    var RATES_AS_OF = '6 Nov 2026';

    // Monthly saving that reaches `target` in `months` months at 12% a year (monthly rate 1.12^(1/12) - 1,
    // saving made at the end of each month)
    function monthlySavingFor(target, months) {
        var monthlyReturn = Math.pow(1.12, 1 / 12) - 1;
        return (target * monthlyReturn) / (Math.pow(1 + monthlyReturn, months) - 1);
    }

    // o: currency, currentCost (in that currency), years, inflationPct (fees), depreciationPct (rupee).
    // Returns null when the cost or the years are missing or zero.
    function calculate(o) {
        var currentCost = o.currentCost;
        var years = o.years;
        if (!(currentCost > 0) || !(years > 0)) return null; // zero, negative or missing: no result, never a negative saving
        var inflationRate = o.inflationPct / 100;
        var depreciationRate = o.depreciationPct / 100;
        var exchangeRate = EXCHANGE_RATES[o.currency];

        var futureCostForeign = currentCost * Math.pow((1 + inflationRate), years);
        var futureExchangeRate = exchangeRate * Math.pow((1 + depreciationRate), years);
        var futureCostINR = futureCostForeign * futureExchangeRate;
        var currentCostINR = currentCost * exchangeRate;

        var costWithJustInflation = currentCost * Math.pow((1 + inflationRate), years) * exchangeRate;
        var costWithJustDepreciation = currentCost * futureExchangeRate;

        return {
            exchangeRate: exchangeRate,
            futureCostForeign: futureCostForeign,
            futureExchangeRate: futureExchangeRate,
            futureCostINR: futureCostINR,
            currentCostINR: currentCostINR,
            increase: futureCostINR - currentCostINR,
            increasePercent: (futureCostINR / currentCostINR - 1) * 100,
            inflationImpact: costWithJustInflation - currentCostINR,
            depreciationImpact: costWithJustDepreciation - currentCostINR,
            combinedRatePercent: (Math.pow(futureCostINR / currentCostINR, 1 / years) - 1) * 100,
            monthlySaving: monthlySavingFor(futureCostINR, years * 12)
        };
    }

    var api = { calculate: calculate, monthlySavingFor: monthlySavingFor, EXCHANGE_RATES: EXCHANGE_RATES, RATES_AS_OF: RATES_AS_OF };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).studyAbroad = api;
})(typeof window !== 'undefined' ? window : this);
