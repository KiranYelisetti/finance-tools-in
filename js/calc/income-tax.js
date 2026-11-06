/*
 * Income tax maths for /income-tax-calculator/: old regime against new regime, FY 2025-26 and tax year 2026-27
 * (same slabs, rebate and standard deduction in both years). Resident individual below 60, slab-rate income only,
 * no surcharge (the page says so). No DOM.
 * Works in the browser as QTCalc.incomeTax and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    // Old regime slabs (below 60): nil to 2.5 lakh, 5% to 5 lakh, 20% to 10 lakh, 30% above.
    function oldRegimeSlabTax(taxableIncome) {
        if (taxableIncome <= 250000) return 0;
        if (taxableIncome <= 500000) return (taxableIncome - 250000) * 0.05;
        if (taxableIncome <= 1000000) return 12500 + (taxableIncome - 500000) * 0.20;
        return 12500 + 100000 + (taxableIncome - 1000000) * 0.30;
    }

    // New regime slabs: nil to 4 lakh, then 5% steps every 4 lakh up to 30% above 24 lakh.
    function newRegimeSlabTax(taxableIncome) {
        if (taxableIncome <= 400000) return 0;
        if (taxableIncome <= 800000) return (taxableIncome - 400000) * 0.05;
        if (taxableIncome <= 1200000) return 20000 + (taxableIncome - 800000) * 0.10;
        if (taxableIncome <= 1600000) return 60000 + (taxableIncome - 1200000) * 0.15;
        if (taxableIncome <= 2000000) return 120000 + (taxableIncome - 1600000) * 0.20;
        if (taxableIncome <= 2400000) return 200000 + (taxableIncome - 2000000) * 0.25;
        return 300000 + (taxableIncome - 2400000) * 0.30;
    }

    // Rebate (old 87A): up to 12,500 when old-regime taxable income is 5 lakh or less, no marginal relief.
    function oldRegimeRebate(taxableIncome, taxBeforeCess) {
        return taxableIncome <= 500000 ? Math.min(taxBeforeCess, 12500) : 0;
    }

    // Rebate (old 87A): up to 60,000 when new-regime taxable income is 12 lakh or less. Just above 12 lakh,
    // marginal relief: tax after rebate cannot exceed the income above 12 lakh.
    function newRegimeRebate(taxableIncome, taxBeforeCess) {
        if (taxableIncome <= 1200000) return Math.min(taxBeforeCess, 60000);
        var excessOver12L = taxableIncome - 1200000;
        return taxBeforeCess > excessOver12L ? taxBeforeCess - excessOver12L : 0;
    }

    // Both regimes for one person. Inputs are rupees a year; caps on 80C (1,50,000), home loan interest
    // (2,00,000) and NPS 80CCD(1B) (50,000) are applied here. Missing figures count as 0.
    function compare(o) {
        var grossSalary = o.grossSalary || 0;
        var otherIncome = o.otherIncome || 0;
        var d80C = Math.min(o.deduction80C || 0, 150000);
        var d80D = o.deduction80D || 0;
        var hra = o.hraExemption || 0;
        var homeLoan = Math.min(o.homeLoanInterest || 0, 200000);
        var nps = Math.min(o.nps80CCD || 0, 50000);
        var otherDed = o.otherDeductions || 0;

        var totalGross = grossSalary + otherIncome;

        // Old regime
        var oldStdDed = Math.min(50000, grossSalary);
        var totalOldDeductions = d80C + d80D + hra + homeLoan + nps + otherDed;
        var oldTaxableIncome = Math.max(0, totalGross - oldStdDed - totalOldDeductions);
        var oldTaxBeforeCess = oldRegimeSlabTax(oldTaxableIncome);
        var oldRebate = oldRegimeRebate(oldTaxableIncome, oldTaxBeforeCess);
        var oldTaxAfterRebate = Math.max(0, oldTaxBeforeCess - oldRebate);
        var oldCess = oldTaxAfterRebate * 0.04;
        var oldTotalTax = Math.round(oldTaxAfterRebate + oldCess);

        // New regime
        var newStdDed = Math.min(75000, grossSalary);
        var newTaxableIncome = Math.max(0, totalGross - newStdDed);
        var newTaxBeforeCess = newRegimeSlabTax(newTaxableIncome);
        var newRebate = newRegimeRebate(newTaxableIncome, newTaxBeforeCess);
        var newTaxAfterRebate = Math.max(0, newTaxBeforeCess - newRebate);
        var newCess = newTaxAfterRebate * 0.04;
        var newTotalTax = Math.round(newTaxAfterRebate + newCess);

        return {
            totalGross: totalGross,
            old: {
                stdDeduction: oldStdDed, deductions: totalOldDeductions, taxableIncome: oldTaxableIncome,
                taxBeforeCess: oldTaxBeforeCess, rebate: oldRebate, cess: oldCess, totalTax: oldTotalTax
            },
            new: {
                stdDeduction: newStdDed, taxableIncome: newTaxableIncome,
                taxBeforeCess: newTaxBeforeCess, rebate: newRebate, cess: newCess, totalTax: newTotalTax
            },
            // 'new', 'old' or 'same', and by how much a year
            better: newTotalTax < oldTotalTax ? 'new' : oldTotalTax < newTotalTax ? 'old' : 'same',
            difference: Math.abs(oldTotalTax - newTotalTax)
        };
    }

    var api = {
        compare: compare, oldRegimeSlabTax: oldRegimeSlabTax, newRegimeSlabTax: newRegimeSlabTax,
        oldRegimeRebate: oldRegimeRebate, newRegimeRebate: newRegimeRebate
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).incomeTax = api;
})(typeof window !== 'undefined' ? window : this);
