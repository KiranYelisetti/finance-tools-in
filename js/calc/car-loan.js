/*
 * Car loan maths for /car-loan-calculator/. No DOM: the page reads the fields and shows the results.
 * Works in the browser as QTCalc.carLoan (via <script src>) and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    // On-road price = ex-showroom + road tax (a % of ex-showroom) + insurance + accessories + other charges.
    // Loan = on-road price - down payment. EMI by the reducing-balance formula.
    function calculate(o) {
        var carPrice = o.carPrice;
        var downPayment = o.downPayment;
        var insurance = o.insurance || 0;
        var rtoTaxPercent = o.rtoTaxPercent || 0;
        var accessories = o.accessories || 0;
        var otherCharges = o.otherCharges || 0;

        var rtoAmount = (carPrice * rtoTaxPercent) / 100;
        var onRoadPrice = carPrice + rtoAmount + insurance + accessories + otherCharges;
        var loanAmount = onRoadPrice - downPayment;

        var monthlyRate = o.annualRate / 12 / 100;
        var tenureMonths = o.tenureYears * 12;
        var emi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
            (Math.pow(1 + monthlyRate, tenureMonths) - 1);

        var totalEMIPayments = emi * tenureMonths;
        var totalInterest = totalEMIPayments - loanAmount;

        return {
            rtoAmount: rtoAmount,
            onRoadPrice: onRoadPrice,
            loanAmount: loanAmount,
            tenureMonths: tenureMonths,
            emi: emi,
            totalEMIPayments: totalEMIPayments,
            totalInterest: totalInterest,
            totalAmountPaid: downPayment + totalEMIPayments,
            interestPercentOfPrice: (totalInterest / carPrice) * 100,
            downPaymentPercent: (downPayment / onRoadPrice) * 100
        };
    }

    var api = { calculate: calculate };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).carLoan = api;
})(typeof window !== 'undefined' ? window : this);
