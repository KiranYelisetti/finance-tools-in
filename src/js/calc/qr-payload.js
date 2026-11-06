/*
 * What goes inside a QR code on /qr-code-generator/, and how a finished code becomes an SVG. No DOM.
 * Works in the browser as QTCalc.qrPayload and in Node via require(). Tested by tests/unit, where every payload is
 * also drawn and read back with a QR decoder.
 *
 * Formats:
 * - Wi-Fi: WIFI:T:<WPA|WEP|nopass>;S:<name>;P:<password>;H:<true|false>;; with \ ; , : and " escaped by a backslash,
 *   the format phone cameras on Android and iOS read.
 * - Phone: tel:<digits, an optional leading +>. Email: mailto:<address>?subject=...&body=... (RFC 6068).
 * - UPI: upi://pay?pa=<UPI ID>&pn=<payee name>&am=<amount>&cu=INR&tn=<note>, the NPCI deep link every UPI app opens.
 *   Values are percent-encoded. The amount is optional and has at most two decimals.
 */
(function (root) {
    'use strict';

    var TYPES = ['text', 'url', 'wifi', 'phone', 'email', 'upi'];

    function fail(field, message) {
        return { ok: false, field: field, error: message };
    }

    function escapeWifi(s) {
        return String(s).replace(/([\\;,:"])/g, '\\$1');
    }

    function trim(v) {
        return String(v == null ? '' : v).trim();
    }

    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var UPI_ID = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$/;

    /**
     * Build the text stored in the code.
     * type: one of TYPES. f: the form fields for that type.
     * Returns { ok: true, payload } or { ok: false, field, error }.
     */
    function build(type, f) {
        f = f || {};
        switch (type) {
            case 'text': {
                var t = String(f.text == null ? '' : f.text);
                if (!t.trim()) return fail('text', 'Type the text to put in the code.');
                return { ok: true, payload: t };
            }
            case 'url': {
                var u = trim(f.url);
                if (!u) return fail('url', 'Type or paste a link.');
                if (!/^[a-z][a-z0-9+.\-]*:/i.test(u)) u = 'https://' + u;
                var parsed;
                try { parsed = new URL(u); } catch (e) { return fail('url', 'That does not look like a web address.'); }
                if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname || parsed.hostname.indexOf('.') < 0) {
                    return fail('url', 'Use a web address such as example.com or https://example.com/page.');
                }
                return { ok: true, payload: u };
            }
            case 'wifi': {
                var ssid = String(f.ssid == null ? '' : f.ssid);
                if (!ssid.trim()) return fail('ssid', 'Type the Wi-Fi network name exactly as it appears.');
                var sec = f.security === 'WEP' || f.security === 'nopass' ? f.security : 'WPA';
                var pass = String(f.password == null ? '' : f.password);
                if (sec !== 'nopass' && !pass) return fail('password', 'Type the Wi-Fi password, or choose No password.');
                if (sec === 'WPA' && pass.length < 8) return fail('password', 'WPA passwords are at least 8 characters long.');
                var parts = ['WIFI:T:' + sec, 'S:' + escapeWifi(ssid)];
                if (sec !== 'nopass') parts.push('P:' + escapeWifi(pass));
                if (f.hidden) parts.push('H:true');
                return { ok: true, payload: parts.join(';') + ';;' };
            }
            case 'phone': {
                var raw = trim(f.phone);
                var plus = raw.charAt(0) === '+';
                var digits = raw.replace(/[^\d]/g, '');
                if (digits.length < 3 || /[^\d\s()+\-.]/.test(raw)) return fail('phone', 'Type a phone number using digits, with + and the country code for other countries.');
                return { ok: true, payload: 'tel:' + (plus ? '+' : '') + digits };
            }
            case 'email': {
                var to = trim(f.email);
                if (!EMAIL.test(to)) return fail('email', 'Type an email address such as name@example.com.');
                var q = [];
                if (trim(f.subject)) q.push('subject=' + encodeURIComponent(trim(f.subject)));
                if (trim(f.body)) q.push('body=' + encodeURIComponent(String(f.body).trim()));
                return { ok: true, payload: 'mailto:' + to + (q.length ? '?' + q.join('&') : '') };
            }
            case 'upi': {
                var pa = trim(f.upiId);
                if (!UPI_ID.test(pa)) return fail('upiId', 'Type a UPI ID such as name@okbank, with the part after the @.');
                var pn = trim(f.name);
                if (!pn) return fail('name', 'Type the name the payer should see.');
                // The UPI ID is checked above (letters, digits, . - _ and one @), so it goes in as is: UPI apps expect a plain @
                var q2 = ['pa=' + pa, 'pn=' + encodeURIComponent(pn)];
                var am = trim(f.amount).replace(/,/g, '');
                if (am) {
                    if (!/^\d+(\.\d{1,2})?$/.test(am) || Number(am) <= 0) return fail('amount', 'Type an amount in rupees, such as 250 or 99.50, or leave it empty.');
                    q2.push('am=' + Number(am).toFixed(2));
                }
                q2.push('cu=INR');
                if (trim(f.note)) q2.push('tn=' + encodeURIComponent(trim(f.note)));
                return { ok: true, payload: 'upi://pay?' + q2.join('&') };
            }
            default:
                return fail('type', 'Unknown code type.');
        }
    }

    /**
     * SVG markup for a finished code. size: modules across, isDark(row, col): true for a black module.
     * margin: quiet zone in modules (the QR standard asks for 4). px: the drawn width and height.
     */
    function toSvg(size, isDark, margin, px) {
        var m = margin == null ? 4 : margin;
        var total = size + 2 * m;
        var d = [];
        for (var r = 0; r < size; r++) {
            for (var c = 0; c < size; c++) {
                if (isDark(r, c)) d.push('M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z');
            }
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '"' +
            (px ? ' width="' + px + '" height="' + px + '"' : '') + ' shape-rendering="crispEdges">' +
            '<rect width="' + total + '" height="' + total + '" fill="#ffffff"/>' +
            '<path fill="#000000" d="' + d.join('') + '"/></svg>';
    }

    var api = { build: build, toSvg: toSvg, escapeWifi: escapeWifi, TYPES: TYPES };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).qrPayload = api;
})(typeof window !== 'undefined' ? window : this);
