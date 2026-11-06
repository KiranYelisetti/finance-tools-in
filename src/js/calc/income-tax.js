/*
 * Income tax maths for /income-tax-calculator/: old regime against new regime, FY 2025-26 and tax year 2026-27
 * (same slabs, rebate and standard deduction in both years). Resident individual below 60, slab-rate income only,
 * surcharge above Rs 50 lakh with marginal relief. No DOM.
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
    // Surcharge for individuals, tax year 2026-27 (Finance Act, 2026): 10% above Rs 50 lakh, 15% above Rs 1 crore,
    // 25% above Rs 2 crore, and 37% above Rs 5 crore in the old regime only (the new regime stops at 25%).
    function surchargeRate(income, regime) {
        if (income > 50000000) return regime === 'old' ? 0.37 : 0.25;
        if (income > 20000000) return 0.25;
        if (income > 10000000) return 0.15;
        if (income > 5000000) return 0.10;
        return 0;
    }

    function taxAfterRebate(taxable, regime) {
        var slab = regime === 'old' ? oldRegimeSlabTax(taxable) : newRegimeSlabTax(taxable);
        var rebate = regime === 'old' ? oldRegimeRebate(taxable, slab) : newRegimeRebate(taxable, slab);
        return Math.max(0, slab - rebate);
    }

    // Marginal relief: tax plus surcharge above a threshold may exceed the tax plus surcharge at that threshold by no
    // more than the income above it.
    function surcharge(taxable, regime) {
        var rate = surchargeRate(taxable, regime);
        if (!rate) return 0;
        var tax = taxAfterRebate(taxable, regime);
        var threshold = [5000000, 10000000, 20000000, 50000000].filter(function (t) { return taxable > t; }).pop();
        var atThreshold = taxAfterRebate(threshold, regime) * (1 + surchargeRate(threshold, regime));
        return Math.min(tax * (1 + rate), atThreshold + (taxable - threshold)) - tax;
    }

    function compare(o) {
        var grossSalary = o.grossSalary || 0;
        var otherIncome = o.otherIncome || 0;
        var d80C = Math.min(o.deduction80C || 0, 150000);
        // Section 126 (was 80D): Rs 25,000 or Rs 50,000 for self and family, the same again for parents, so Rs 1,00,000 at most
        var d80D = Math.min(o.deduction80D || 0, 100000);
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
        var oldSurcharge = surcharge(oldTaxableIncome, 'old');
        var oldCess = (oldTaxAfterRebate + oldSurcharge) * 0.04;
        var oldTotalTax = Math.round(oldTaxAfterRebate + oldSurcharge + oldCess);

        // New regime
        var newStdDed = Math.min(75000, grossSalary);
        var newTaxableIncome = Math.max(0, totalGross - newStdDed);
        var newTaxBeforeCess = newRegimeSlabTax(newTaxableIncome);
        var newRebate = newRegimeRebate(newTaxableIncome, newTaxBeforeCess);
        var newTaxAfterRebate = Math.max(0, newTaxBeforeCess - newRebate);
        var newSurcharge = surcharge(newTaxableIncome, 'new');
        var newCess = (newTaxAfterRebate + newSurcharge) * 0.04;
        var newTotalTax = Math.round(newTaxAfterRebate + newSurcharge + newCess);

        return {
            totalGross: totalGross,
            old: {
                stdDeduction: oldStdDed, deductions: totalOldDeductions, taxableIncome: oldTaxableIncome,
                taxBeforeCess: oldTaxBeforeCess, rebate: oldRebate, surcharge: oldSurcharge, cess: oldCess, totalTax: oldTotalTax
            },
            new: {
                stdDeduction: newStdDed, taxableIncome: newTaxableIncome,
                taxBeforeCess: newTaxBeforeCess, rebate: newRebate, surcharge: newSurcharge, cess: newCess, totalTax: newTotalTax
            },
            // 'new', 'old' or 'same', and by how much a year
            better: newTotalTax < oldTotalTax ? 'new' : oldTotalTax < newTotalTax ? 'old' : 'same',
            difference: Math.abs(oldTotalTax - newTotalTax)
        };
    }

    var api = { surcharge: surcharge,
        compare: compare, oldRegimeSlabTax: oldRegimeSlabTax, newRegimeSlabTax: newRegimeSlabTax,
        oldRegimeRebate: oldRegimeRebate, newRegimeRebate: newRegimeRebate
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).incomeTax = api;
})(typeof window !== 'undefined' ? window : this);
