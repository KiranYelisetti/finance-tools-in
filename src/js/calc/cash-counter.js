/*
 * Cash counter maths for /cash-counter/. No DOM.
 * Works in the browser as QTCalc.cashCounter and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    // Face value of each box on the page, by the box's id
    var DENOMINATIONS = {
        note2000: 2000, note500: 500, note200: 200, note100: 100, note50: 50, note20: 20, note10: 10,
        coin20: 20, coin10: 10, coin5: 5, coin2: 2, coin1: 1
    };
    var MAX_COUNT = 99999;

    // A typed count as a whole number from 0 to 99,999. `changed` says the box should show the corrected count.
    function clampCount(raw) {
        var count = parseInt(raw) || 0;
        if (count > MAX_COUNT) return { count: MAX_COUNT, changed: true };
        if (count < 0) return { count: 0, changed: true };
        return { count: count, changed: false };
    }

    // Total rupees for counts keyed by box id
    function total(counts) {
        var sum = 0;
        for (var id in DENOMINATIONS) {
            if (Object.prototype.hasOwnProperty.call(DENOMINATIONS, id)) sum += (counts[id] || 0) * DENOMINATIONS[id];
        }
        return sum;
    }

    // The words line under the total, e.g. 15750 -> "15 Thousand 7 Hundred 50 Rupees". Empty for 0.
    function numberToWords(num) {
        if (num === 0) return '';
        var crore = Math.floor(num / 10000000);
        var lakh = Math.floor((num % 10000000) / 100000);
        var thousand = Math.floor((num % 100000) / 1000);
        var hundred = Math.floor((num % 1000) / 100);
        var remainder = num % 100;

        var words = [];
        if (crore > 0) words.push(crore + ' Crore');
        if (lakh > 0) words.push(lakh + ' Lakh');
        if (thousand > 0) words.push(thousand + ' Thousand');
        if (hundred > 0) words.push(hundred + ' Hundred');
        if (remainder > 0) words.push(remainder);
        return words.join(' ') + ' Rupees';
    }

    var api = { DENOMINATIONS: DENOMINATIONS, MAX_COUNT: MAX_COUNT, clampCount: clampCount, total: total, numberToWords: numberToWords };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).cashCounter = api;
})(typeof window !== 'undefined' ? window : this);
