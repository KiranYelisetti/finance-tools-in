/*
 * Gratuity maths for /gratuity-calculator/. No DOM.
 * Works in the browser as QTCalc.gratuity and in Node via require(). Tested by tests/unit.
 *
 * The law, checked in official sources (revenue-hq/research/tax_law_2026/gratuity_rules_2026-11-06.md):
 * - Exit on or after 21 Nov 2025: Code on Social Security, 2020, sections 53 and 54 (S.O. 5319(E)). The whole career
 *   counts, on the wages last drawn under the Code's wider definition (Ministry of Labour FAQ, 16 Mar 2026, Sl. 17).
 * - Exit before 21 Nov 2025: Payment of Gratuity Act, 1972, same formula on basic pay plus DA.
 * - Gratuity = monthly wages x 15 / 26 x years, where a part year of MORE than six months counts as a full year.
 * - Code wages: basic + DA + retaining allowance. If the other pay is more than half of all remuneration, the excess is
 *   added back (section 2(88)), which is the same as max(basic + DA, half of total pay).
 * - Ceiling Rs 20,00,000 (S.O. 1420(E), 2018, saved by section 164(2)(a)). Central government employees under the CCS
 *   rules are outside the Code, ceiling Rs 25,00,000 from 1 Jan 2024.
 * - Tax: Income-tax Act, 2025, section 19(1) Table. Government employees: fully exempt. Others covered by the gratuity
 *   law: exempt up to the least of the amount received, 15/26 of last salary (basic + DA) per year, and Rs 20,00,000.
 */
(function (root) {
    'use strict';

    var DAY_MS = 86400000;
    var CODE_START = '2025-11-21';
    var CAP = 2000000;
    var CCS_CAP = 2500000;
    var TAX_FREE_LIMIT = 2000000;

    function parse(s) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
        return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
    }
    function dayNumber(x) { return Date.UTC(x.y, x.m - 1, x.d) / DAY_MS; }
    function addMonths(x, k) { return Date.UTC(x.y, x.m - 1 + k, x.d) / DAY_MS; }

    // Length of service from the joining date to the last working day, both days counted.
    // counted = completed years, plus one when the rest is more than six months (exactly six months does not count).
    function service(joinDate, lastDay) {
        var a = parse(joinDate), b = parse(lastDay);
        if (!a || !b) return null;
        var end = dayNumber(b) + 1; // the last working day is a day of service
        if (end <= dayNumber(a)) return null;
        var k = 0;
        while (addMonths(a, k + 1) <= end) k++;
        var years = Math.floor(k / 12), months = k % 12, days = end - addMonths(a, k);
        var overSix = months > 6 || (months === 6 && days > 0);
        return { years: years, months: months, days: days, counted: years + (overSix ? 1 : 0) };
    }

    // Which law decides: the date the employee leaves
    function lawFor(lastDay) {
        return String(lastDay) >= CODE_START ? 'code' : 'act1972';
    }

    // Monthly wages for gratuity
    function wages(basicDA, otherPay, law) {
        var w = Math.max(0, basicDA || 0), e = Math.max(0, otherPay || 0);
        if (law !== 'code') return w;
        return Math.max(w, 0.5 * (w + e));
    }

    // Minimum continuous service before gratuity is due
    function minimumYears(type, reason, law) {
        if (reason === 'death' || reason === 'disablement') return 0;
        if (type === 'fixedTerm' && law === 'code') return 1;
        if (type === 'journalist') return 3;
        return 5;
    }

    /*
     * o: { joinDate, lastDay, basicDA, otherPay, type: 'permanent' | 'journalist' | 'fixedTerm' | 'government',
     *      reason: 'resignation' | 'retirement' | 'death' | 'disablement' | 'contractEnd' }
     * Returns null when a date or the pay is missing or the dates are reversed.
     */
    function calculate(o) {
        var s = service(o.joinDate, o.lastDay);
        if (!s || !(o.basicDA > 0)) return null;
        var type = o.type || 'permanent';
        var reason = o.reason || 'resignation';
        var gov = type === 'government';
        var law = gov ? 'ccs' : lawFor(o.lastDay);

        var minYears = minimumYears(type, reason, law);
        var eligible = minYears === 0 ? s.years + s.months + s.days > 0 : s.years >= minYears;

        var monthlyWage = wages(o.basicDA, o.otherPay, law);
        var oldRuleWage = Math.max(0, o.basicDA);
        var formula = monthlyWage * 15 / 26 * s.counted;
        var oldRuleFormula = oldRuleWage * 15 / 26 * s.counted;
        var cap = gov ? CCS_CAP : CAP;
        var payable = eligible ? Math.min(formula, cap) : 0;

        // Tax: government employees fully exempt. Others: least of received, 15/26 of basic + DA per year, Rs 20 lakh.
        var exempt = gov ? payable : Math.min(payable, oldRuleFormula, TAX_FREE_LIMIT);

        return {
            law: law,
            service: s,
            minYears: minYears,
            eligible: eligible,
            monthlyWage: monthlyWage,
            addedByHalfRule: monthlyWage - oldRuleWage,
            formula: formula,
            oldRuleFormula: oldRuleFormula,
            cap: cap,
            capped: eligible && formula > cap,
            payable: payable,
            taxFree: exempt,
            taxable: payable - exempt
        };
    }

    var api = {
        calculate: calculate, service: service, lawFor: lawFor, wages: wages, minimumYears: minimumYears,
        CODE_START: CODE_START, CAP: CAP, CCS_CAP: CCS_CAP, TAX_FREE_LIMIT: TAX_FREE_LIMIT
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).gratuity = api;
})(typeof window !== 'undefined' ? window : this);
