/*
 * Salary maths for /salary-calculator/: CTC to monthly in-hand pay, tax estimated under the new regime. No DOM.
 * Works in the browser as QTCalc.salary and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    // Yearly tax under the new regime on a salary: 75,000 standard deduction, the slabs, the rebate up to
    // 12 lakh taxable with marginal relief above it, 4% cess. Rounded to the rupee.
    function newRegimeTax(grossAnnual) {
        var stdDed = Math.min(75000, grossAnnual);
        var taxableIncome = Math.max(0, grossAnnual - stdDed);
        var tax = 0;
        if (taxableIncome <= 400000) tax = 0;
        else if (taxableIncome <= 800000) tax = (taxableIncome - 400000) * 0.05;
        else if (taxableIncome <= 1200000) tax = 20000 + (taxableIncome - 800000) * 0.10;
        else if (taxableIncome <= 1600000) tax = 60000 + (taxableIncome - 1200000) * 0.15;
        else if (taxableIncome <= 2000000) tax = 120000 + (taxableIncome - 1600000) * 0.20;
        else if (taxableIncome <= 2400000) tax = 200000 + (taxableIncome - 2000000) * 0.25;
        else tax = 300000 + (taxableIncome - 2400000) * 0.30;

        if (taxableIncome <= 1200000) {
            tax = Math.max(0, tax - 60000);
        } else {
            var excessOver12L = taxableIncome - 1200000;
            if (tax > excessOver12L) tax = excessOver12L;
        }
        tax = tax + tax * 0.04;
        return Math.round(tax);
    }

    // o: annualCTC, cityType ('metro' or anything else), basicPercent, monthlyBonus, profTax (a month).
    // Monthly figures: basic, HRA (50% of basic in a metro, else 40%), employer PF 12% and gratuity 4.81% of basic,
    // employer ESI 3.25% when monthly CTC is 21,000 or less, special allowance = what is left of monthly CTC.
    function calculate(o) {
        var annualCTC = o.annualCTC;
        var basicPercent = o.basicPercent;
        var monthlyBonus = o.monthlyBonus || 0;
        var profTax = o.profTax || 0;

        var annualBasic = annualCTC * (basicPercent / 100);
        var monthlyBasic = annualBasic / 12;

        var hraPercent = o.cityType === 'metro' ? 50 : 40;
        var monthlyHRA = monthlyBasic * (hraPercent / 100);

        var monthlyEmployerPF = monthlyBasic * 0.12;
        var monthlyEmployeePF = monthlyBasic * 0.12;
        var monthlyGratuity = monthlyBasic * 0.0481;

        var grossBeforeESI = annualCTC / 12;
        var monthlyEmployerESI = grossBeforeESI <= 21000 ? grossBeforeESI * 0.0325 : 0;

        var monthlyCTC = annualCTC / 12;
        var monthlySpecialAllowance = Math.max(0, monthlyCTC - monthlyBasic - monthlyHRA - monthlyEmployerPF - monthlyGratuity - monthlyEmployerESI);

        var monthlyGross = monthlyBasic + monthlyHRA + monthlySpecialAllowance + monthlyBonus;

        var annualGross = monthlyGross * 12;
        var annualTax = newRegimeTax(annualGross);
        var monthlyTDS = Math.round(annualTax / 12);

        var totalMonthlyDeductions = monthlyEmployeePF + profTax + monthlyTDS;
        var monthlyInHand = monthlyGross - totalMonthlyDeductions;

        return {
            hraPercent: hraPercent,
            monthlyBasic: monthlyBasic,
            monthlyHRA: monthlyHRA,
            monthlySpecialAllowance: monthlySpecialAllowance,
            monthlyBonus: monthlyBonus,
            monthlyGross: monthlyGross,
            monthlyEmployeePF: monthlyEmployeePF,
            profTax: profTax,
            annualTax: annualTax,
            monthlyTDS: monthlyTDS,
            totalMonthlyDeductions: totalMonthlyDeductions,
            monthlyInHand: monthlyInHand,
            annualInHand: monthlyInHand * 12,
            monthlyEmployerPF: monthlyEmployerPF,
            monthlyGratuity: monthlyGratuity,
            monthlyEmployerESI: monthlyEmployerESI
        };
    }

    var api = { calculate: calculate, newRegimeTax: newRegimeTax };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).salary = api;
})(typeof window !== 'undefined' ? window : this);
