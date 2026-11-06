/*
 * Wedding cost maths for /wedding-cost-calculator/. No DOM.
 * Works in the browser as QTCalc.weddingCost and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    var DESTINATION_PREMIUM = 0.20; // a destination wedding adds 20%
    var GOLD_GROWTH = 0.10;         // gold assumed to rise 10% a year

    // Monthly saving that reaches `target` in `months` months at 12% a year (monthly rate 1.12^(1/12) - 1,
    // saving made at the end of each month)
    function monthlySavingFor(target, months) {
        var monthlyReturn = Math.pow(1.12, 1 / 12) - 1;
        return (target * monthlyReturn) / (Math.pow(1 + monthlyReturn, months) - 1);
    }

    // o: baseBudget (today), years, inflationPct, isDestination, hasGold, goldAmount (today).
    // Returns null when the budget or the years are missing or zero.
    function calculate(o) {
        var baseBudget = o.baseBudget;
        var years = o.years;
        if (!baseBudget || !years) return null;
        var inflationRate = o.inflationPct / 100;
        var goldAmount = o.hasGold ? (o.goldAmount || 0) : 0;

        // The wedding itself, grown by inflation. A destination wedding's 20% premium is its own line, so the
        // breakdown (wedding + premium + gold) adds up to the total and the premium is never counted twice.
        var futureWeddingCost = baseBudget * Math.pow((1 + inflationRate), years);
        var destinationPremium = o.isDestination ? futureWeddingCost * DESTINATION_PREMIUM : 0;

        var futureGoldCost = 0;
        if (o.hasGold) futureGoldCost = goldAmount * Math.pow((1 + GOLD_GROWTH), years);

        var totalFutureCost = futureWeddingCost + destinationPremium + futureGoldCost;
        var currentTotalCost = baseBudget + (o.isDestination ? baseBudget * DESTINATION_PREMIUM : 0) + goldAmount;

        return {
            futureWeddingCost: futureWeddingCost, // the wedding alone, without the destination premium
            destinationPremium: destinationPremium,
            futureGoldCost: futureGoldCost,
            totalFutureCost: totalFutureCost,
            currentTotalCost: currentTotalCost,
            increase: totalFutureCost - currentTotalCost,
            increasePercent: (totalFutureCost / currentTotalCost - 1) * 100,
            monthlySaving: monthlySavingFor(totalFutureCost, years * 12)
        };
    }

    var api = { calculate: calculate, monthlySavingFor: monthlySavingFor };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).weddingCost = api;
})(typeof window !== 'undefined' ? window : this);
