/*
 * GST maths for /gst-calculator/. No DOM.
 * Works in the browser as QTCalc.gst and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    // Custom rate typed by hand: not a number or below 0 counts as 0, above 100 counts as 100.
    function clampCustomRate(value) {
        var custom = parseFloat(value);
        if (isNaN(custom) || custom < 0) custom = 0;
        if (custom > 100) custom = 100;
        return custom;
    }

    // type 'add': amount is before GST. Any other type: amount already includes GST.
    // Within a state CGST and SGST are half each; between states IGST is the whole tax.
    // Returns null for a zero, negative or missing amount.
    function calculate(amount, gstRate, type) {
        if (!amount || amount <= 0) return null;
        var originalAmount, gstAmount, finalAmount;
        if (type === 'add') {
            originalAmount = amount;
            gstAmount = (amount * gstRate) / 100;
            finalAmount = amount + gstAmount;
        } else {
            finalAmount = amount;
            originalAmount = (amount * 100) / (100 + gstRate);
            gstAmount = amount - originalAmount;
        }
        return {
            originalAmount: originalAmount,
            gstAmount: gstAmount,
            finalAmount: finalAmount,
            cgst: gstAmount / 2,
            sgst: gstAmount / 2,
            igst: gstAmount
        };
    }

    var api = { calculate: calculate, clampCustomRate: clampCustomRate };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).gst = api;
})(typeof window !== 'undefined' ? window : this);
