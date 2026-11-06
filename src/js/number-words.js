/*
 * Number to Words engine for quicktoolsplus.com/number-to-words/.
 * Reads plain amounts ("1500000", "15,00,000", "1500.50") and amounts written with units
 * ("1.5 crore", "1 cr 30 lakh", "270 lakh crore", "15 hazar crore", "6 arab", "2.5 million"),
 * and returns the digits, the Indian and international words and the cheque wording.
 * All maths is BigInt, so there is no 999 crore cap. Tested by scripts/test-number-words.mjs.
 */
(function (root) {
    'use strict';

    var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    var TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    // Every unit is a power of ten, so "270 lakh crore" is 270 x 10^5 x 10^7.
    var UNITS = {
        hundred: 2, hundreds: 2,
        thousand: 3, thousands: 3, k: 3, hazar: 3, hazaar: 3, hajar: 3, hajaar: 3,
        lakh: 5, lakhs: 5, lac: 5, lacs: 5, l: 5, lk: 5, lkh: 5,
        million: 6, millions: 6, mn: 6, m: 6,
        crore: 7, crores: 7, cr: 7, crs: 7, karod: 7, karor: 7, caror: 7,
        arab: 9, billion: 9, billions: 9, bn: 9, b: 9,
        kharab: 11,
        trillion: 12, trillions: 12, tn: 12
    };

    // English number words, so "twenty five lakh" and "one crore" read too.
    var WORDNUM = {
        zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
        eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
        nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80,
        ninety: 90, a: 1, an: 1
    };

    // Words people type around the amount, which carry no value.
    var NOISE = ['rs', 'inr', 'rupee', 'rupees', 'only', 'in', 'into', 'to', 'words', 'word', 'numbers', 'number',
        'numeric', 'digits', 'digit', 'figures', 'figure', 'and', 'of', 'is', 'convert', 'how', 'much', 'many',
        'what', 'write', 'writing', 'the', 'zeros', 'zeroes', 'amount', 'value', 'equals', 'equal'];

    var SCALE = 20; // values are kept as BigInt rupees x 10^20, so decimals stay exact
    var TEN = BigInt(10);
    var ZERO = BigInt(0);
    var LIMIT = TEN ** BigInt(17) * TEN ** BigInt(SCALE); // 1,00,000 lakh crore (10^17 rupees), exclusive

    function pow10(e) { return TEN ** BigInt(e); }

    function tokenize(raw) {
        var s = String(raw).toLowerCase()
            .replace(/₹/g, ' ')
            .replace(/(\d),(?=\d)/g, '$1')      // 15,00,000 -> 1500000
            .replace(/rs\./g, ' ');
        var tokens = [];
        // After a number, "in", "into" or "to" starts the target: "3500000 in words in lakhs" means
        // show 3500000 in lakhs, so any unit after it is dropped instead of multiplying.
        var target = false;
        var re = /(\d+(?:\.\d*)?|\.\d+)|([a-z]+)/g;
        var m;
        while ((m = re.exec(s)) !== null) {
            var w = m[2];
            var last = tokens[tokens.length - 1];
            if (m[1] !== undefined) {
                if (target) return { error: 'Type one amount, for example 15 lakh or 1500000.' };
                tokens.push({ type: 'num', text: m[1] });
            }
            else if (target && Object.prototype.hasOwnProperty.call(UNITS, w)) continue;
            else if ((w === 'in' || w === 'into' || w === 'to') && tokens.length) target = true;
            else if (Object.prototype.hasOwnProperty.call(WORDNUM, w)) {
                var v = WORDNUM[w];
                // "twenty five" is one number
                if (last && last.word && last.value >= 20 && last.value % 10 === 0 && v > 0 && v < 10) {
                    last.value += v;
                    last.text = String(last.value);
                } else tokens.push({ type: 'num', text: String(v), value: v, word: true });
            }
            else if (Object.prototype.hasOwnProperty.call(UNITS, m[2])) tokens.push({ type: 'unit', exp: UNITS[m[2]], text: m[2] });
            else if (NOISE.indexOf(m[2]) === -1) return { error: 'Could not read "' + m[2] + '". Try 15 lakh, 1.5 crore or 1500000.' };
        }
        return { tokens: tokens };
    }

    // "1.5" -> 1.5 x 10^20 as BigInt
    function scaledNumber(text) {
        var parts = text.split('.');
        var intPart = parts[0] || '0';
        var frac = (parts[1] || '').slice(0, SCALE);
        while (frac.length < SCALE) frac += '0';
        return BigInt(intPart) * pow10(SCALE) + BigInt(frac);
    }

    // The largest unit splits the phrase: (left) x unit + (right).
    // The FIRST occurrence wins, so "5 lakh crore 30 thousand crore" is 5 lakh crore plus 30 thousand crore,
    // and "2 lakh 50 thousand crore" is (2 lakh 50 thousand) crore.
    function evaluate(tokens) {
        if (tokens.length === 0) return { value: null };
        var best = -1;
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i].type === 'unit' && (best === -1 || tokens[i].exp > tokens[best].exp)) best = i;
        }
        if (best === -1) {
            if (tokens.length > 1) return { error: 'Two numbers without a unit between them. Try 15 lakh or 1500000.' };
            return { value: scaledNumber(tokens[0].text) };
        }
        var left = tokens.slice(0, best);
        var right = tokens.slice(best + 1);
        var l = left.length ? evaluate(left) : { value: pow10(SCALE) }; // "crore" alone means 1 crore
        if (l.error) return l;
        var r = right.length ? evaluate(right) : { value: ZERO };
        if (r.error) return r;
        return { value: l.value * pow10(tokens[best].exp) + r.value };
    }

    // Returns { rupees: BigInt, paise: Number, hasUnits: Boolean } or { error } or { empty: true }.
    function parseAmount(raw) {
        var t = tokenize(raw);
        if (t.error) return { error: t.error };
        if (t.tokens.length === 0) return { empty: true };
        var hasUnits = t.tokens.some(function (x) { return x.type === 'unit'; });
        var v = evaluate(t.tokens);
        if (v.error) return { error: v.error };
        if (v.value >= LIMIT) return { error: 'That is more than 99,999 lakh crore (10^17), the largest amount this tool reads.' };
        var unit = pow10(SCALE);
        var rupees = v.value / unit;
        var rest = v.value % unit;                       // fraction of a rupee, x 10^20
        var paiseScaled = rest * BigInt(100);
        var paise = paiseScaled / unit;
        if ((paiseScaled % unit) * BigInt(2) >= unit) paise += BigInt(1); // half up
        if (paise >= BigInt(100)) { rupees += BigInt(1); paise -= BigInt(100); }
        return { rupees: rupees, paise: Number(paise), hasUnits: hasUnits };
    }

    function below100(n) {
        if (n === 0) return '';
        if (n < 10) return ONES[n];
        if (n < 20) return TEENS[n - 10];
        return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
    }

    function below1000(n) {
        if (n < 100) return below100(n);
        var r = n % 100;
        return ONES[Math.floor(n / 100)] + ' Hundred' + (r ? ' ' + below100(r) : '');
    }

    // 0 .. 99,999
    function below1e5(n) {
        var th = Math.floor(n / 1000), r = n % 1000, out = [];
        if (th) out.push(below100(th) + ' Thousand');
        if (r) out.push(below1000(r));
        return out.join(' ');
    }

    // Number of crores, read the way Indian papers do: "Two Hundred Seventy Lakh" (crore follows).
    function croreCountWords(c) {
        var lakhs = Number(c / BigInt(100000)), rest = Number(c % BigInt(100000)), out = [];
        if (lakhs) out.push(below1e5(lakhs) + ' Lakh');
        if (rest) out.push(below1e5(rest));
        return out.join(' ');
    }

    function splitIndian(n) {
        return {
            crore: n / BigInt(10000000),
            lakh: Number((n % BigInt(10000000)) / BigInt(100000)),
            thousand: Number((n % BigInt(100000)) / BigInt(1000)),
            rest: Number(n % BigInt(1000))
        };
    }

    function indianWords(n) {
        if (n === ZERO) return 'Zero';
        var p = splitIndian(n), out = [];
        if (p.crore > ZERO) out.push(croreCountWords(p.crore) + ' Crore');
        if (p.lakh) out.push(below100(p.lakh) + ' Lakh');
        if (p.thousand) out.push(below100(p.thousand) + ' Thousand');
        if (p.rest) out.push(below1000(p.rest));
        return out.join(' ');
    }

    function groupIndian(n) {
        var s = String(n);
        if (s.length <= 3) return s;
        var last3 = s.slice(-3), rest = s.slice(0, -3), parts = [];
        while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
        if (rest) parts.unshift(rest);
        return parts.join(',') + ',' + last3;
    }

    function groupInternational(n) {
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // "270 Lakh Crore", "1 Crore 50 Lakh", "1,234 Crore 5 Thousand"
    function describeIndian(n) {
        if (n === ZERO) return '0';
        var p = splitIndian(n), out = [];
        if (p.crore > ZERO) {
            var lakhs = p.crore / BigInt(100000), rest = p.crore % BigInt(100000), c = [];
            if (lakhs > ZERO) c.push(groupIndian(lakhs) + ' Lakh');
            if (rest > ZERO) c.push(groupIndian(rest));
            out.push(c.join(' ') + ' Crore');
        }
        if (p.lakh) out.push(p.lakh + ' Lakh');
        if (p.thousand) out.push(p.thousand + ' Thousand');
        if (p.rest) out.push(String(p.rest));
        return out.join(' ');
    }

    function splitInternational(n) {
        return {
            trillion: Number(n / BigInt(1e12)),
            billion: Number((n % BigInt(1e12)) / BigInt(1e9)),
            million: Number((n % BigInt(1e9)) / BigInt(1e6)),
            thousand: Number((n % BigInt(1e6)) / BigInt(1000)),
            rest: Number(n % BigInt(1000))
        };
    }

    // 0 .. 999,999
    function below1e6(n) {
        var th = Math.floor(n / 1000), r = n % 1000, out = [];
        if (th) out.push(below1000(th) + ' Thousand');
        if (r) out.push(below1000(r));
        return out.join(' ');
    }

    function internationalWords(n) {
        if (n === ZERO) return 'Zero';
        var p = splitInternational(n), out = [];
        if (p.trillion) out.push(below1e6(p.trillion) + ' Trillion');
        if (p.billion) out.push(below1000(p.billion) + ' Billion');
        if (p.million) out.push(below1000(p.million) + ' Million');
        if (p.thousand) out.push(below1000(p.thousand) + ' Thousand');
        if (p.rest) out.push(below1000(p.rest));
        return out.join(' ');
    }

    function describeInternational(n) {
        if (n === ZERO) return '0';
        var p = splitInternational(n), out = [];
        if (p.trillion) out.push(groupInternational(p.trillion) + ' Trillion');
        if (p.billion) out.push(p.billion + ' Billion');
        if (p.million) out.push(p.million + ' Million');
        if (p.thousand) out.push(p.thousand + ' Thousand');
        if (p.rest) out.push(String(p.rest));
        return out.join(' ');
    }

    function digitsInWords(str) {
        var names = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        return String(str).split('').map(function (d) { return names[parseInt(d, 10)]; }).join(' ');
    }

    // Everything the page shows for one input.
    function convert(raw) {
        var a = parseAmount(raw);
        if (a.error || a.empty) return a;
        var r = a.rupees, paise = a.paise;
        var paiseDigits = paise > 0 ? String(paise).padStart(2, '0') : '';
        var paiseText = paise > 0 ? ' and ' + below100(paise) + ' Paise' : '';
        var words = indianWords(r);
        var digits = String(r);
        return {
            rupees: r,
            paise: paise,
            hasUnits: a.hasUnits,
            plain: digits + (paise > 0 ? '.' + paiseDigits : ''),
            indianFormat: describeIndian(r),
            indianGrouped: groupIndian(r) + (paise > 0 ? '.' + paiseDigits : ''),
            internationalFormat: describeInternational(r),
            internationalGrouped: groupInternational(r) + (paise > 0 ? '.' + paiseDigits : ''),
            inWords: words + ' Rupees' + paiseText + ' Only',
            cheque: 'Rupees ' + words + paiseText + ' Only',
            internationalWords: internationalWords(r) + (paise > 0 ? ' Point ' + digitsInWords(paiseDigits) : ''),
            digitCount: digits.length,
            zeroCount: (digits.match(/0/g) || []).length - (r === ZERO ? 1 : 0)
        };
    }

    // Rupees expressed in a unit of 10^exp, as a plain decimal: inUnit(9800000000000n, 12) -> "9.8"
    function inUnit(rupees, exp) {
        var d = pow10(exp), whole = rupees / d, frac = String(rupees % d).padStart(exp, '0').replace(/0+$/, '');
        return frac ? whole + '.' + frac : String(whole);
    }

    var api = {
        inUnit: inUnit,
        convert: convert, parseAmount: parseAmount, indianWords: indianWords, internationalWords: internationalWords,
        groupIndian: groupIndian, groupInternational: groupInternational, describeIndian: describeIndian,
        describeInternational: describeInternational
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NumberWords = api;
})(typeof window !== 'undefined' ? window : this);
