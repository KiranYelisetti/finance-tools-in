/*
 * SIP maths for /sip-calculator/. No DOM.
 * Works in the browser as QTCalc.sip and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    // FV = P x ((1 + i)^n - 1) / i x (1 + i): i = annual % / 12 / 100, n = years x 12, each instalment
    // invested at the start of its month. At 0% the value is simply what was invested.
    function futureValue(monthly, annualPct, years) {
        var i = annualPct / 12 / 100;
        var n = years * 12;
        var fv;
        if (i === 0) {
            fv = monthly * n;
        } else {
            fv = monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        }
        var invested = monthly * n;
        return { futureValue: fv, invested: invested, returns: fv - invested };
    }

    var api = { futureValue: futureValue };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).sip = api;
})(typeof window !== 'undefined' ? window : this);
