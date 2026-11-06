/*
 * Text statistics for /word-counter/. No DOM.
 * Works in the browser as QTCalc.wordCount and in Node via require(). Tested by tests/unit.
 *
 * Rules (stated on the page):
 * - A word is a run of characters between spaces that holds at least one letter or digit, the rule Microsoft Word
 *   uses. "e.g.", "3.5" and "well-known" are one word each. Chinese and Japanese characters, written without spaces,
 *   count one word each.
 * - Characters are what a reader sees as one character (grapheme clusters where the browser can tell, so an emoji
 *   with a skin tone or a Hindi conjunct counts once). Line breaks count as one character each.
 * - Sentences end at . ! ? and the Devanagari danda, when followed by a space, a line break or the end.
 * - Paragraphs are non-empty lines, as in Word.
 * - Reading time uses 238 words a minute by default: the average silent reading rate for English non-fiction in
 *   Brysbaert (2019), "How many words do we read per minute?", Journal of Memory and Language 109.
 *   Speaking time uses 140 words a minute by default, an assumption for an unhurried talk. Both can be changed.
 * - SMS parts follow 3GPP TS 23.038: GSM 7-bit text fits 160 characters in one message and 153 per part when split
 *   (characters from the extension table such as { } [ ] ~ ^ \ | and the euro sign take two). Anything outside the
 *   GSM set (Hindi, most emoji, curly quotes) switches the message to UCS-2: 70 in one message, 67 per part.
 */
(function (root) {
    'use strict';

    var READ_WPM = 238;
    var SPEAK_WPM = 140;

    var HAS_WORDCHAR = /[\p{L}\p{N}]/u;
    var CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;
    var SENTENCE_END = /[.!?।॥]+(?=["'’”)\]]*(?:\s|$))/g;

    var GSM_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
    var GSM_EXT = '^{}\\[~]|€\f';

    // Common English words left out of the "most used words" list when the visitor asks
    var STOP = ('a about above after again against all am an and any are as at be because been before being below between both but by ' +
        'can could did do does doing down during each few for from further had has have having he her here hers herself him himself ' +
        'his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ' +
        'ourselves out over own same she should so some such than that the their theirs them themselves then there these they this ' +
        'those through to too under until up very was we were what when where which while who whom why will with would you your ' +
        'yours yourself yourselves also may might must shall us one two its it\'s i\'m don\'t can\'t won\'t').split(' ');
    var STOP_SET = {};
    for (var s = 0; s < STOP.length; s++) STOP_SET[STOP[s]] = true;

    // Characters as people see them. Older engines (Node 20, older phone browsers) slow down badly when
    // Intl.Segmenter walks one huge string, so the text goes in pieces of about 4,000 characters, each cut
    // just after a space. A grapheme never contains a space, so cutting there never splits one.
    var PIECE = 4000;

    function graphemes(text) {
        if (typeof Intl === 'undefined' || !Intl.Segmenter) return Array.from(text).length;
        var seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        var n = 0, start = 0;
        while (start < text.length) {
            var end = Math.min(text.length, start + PIECE);
            if (end < text.length) {
                // Step back to just after the nearest space, tab or line break. With none nearby, at least
                // never cut between the two halves of an emoji or other surrogate pair.
                var cut = end;
                while (cut > end - 400 && cut > start && !/\s/.test(text.charAt(cut - 1))) cut--;
                if (cut > start && /\s/.test(text.charAt(cut - 1))) {
                    end = cut;
                } else {
                    // No space nearby: let the segmenter pick the boundary, looking at a small window around the cut
                    var lo = Math.max(start + 1, end - 64);
                    var wit = seg.segment(text.slice(lo, Math.min(text.length, end + 64)))[Symbol.iterator]();
                    var best = 0;
                    for (var w = wit.next(); !w.done && w.value.index <= end - lo; w = wit.next()) best = w.value.index;
                    if (lo + best > start) end = lo + best;
                }
            }
            var it = seg.segment(text.slice(start, end))[Symbol.iterator]();
            for (var r = it.next(); !r.done; r = it.next()) n++;
            start = end;
        }
        return n;
    }

    function tokens(text) {
        return text.split(/\s+/).filter(function (t) { return t && HAS_WORDCHAR.test(t); });
    }

    function countWords(text) {
        var n = 0;
        var list = tokens(text);
        for (var i = 0; i < list.length; i++) {
            var cjk = list[i].match(CJK);
            if (!cjk) { n++; continue; }
            // Each CJK character is a word; the rest of the token (Latin letters, digits) counts once if present
            var rest = list[i].replace(CJK, ' ').trim();
            n += cjk.length + (rest && HAS_WORDCHAR.test(rest) ? tokens(rest).length : 0);
        }
        return n;
    }

    function countSentences(text) {
        var parts = text.replace(/\r\n?/g, '\n').split(SENTENCE_END);
        var n = 0;
        for (var i = 0; i < parts.length; i++) if (HAS_WORDCHAR.test(parts[i])) n++;
        return n;
    }

    function countParagraphs(text) {
        return text.replace(/\r\n?/g, '\n').split('\n').filter(function (l) { return HAS_WORDCHAR.test(l); }).length;
    }

    /** Minutes for a word count at a pace in words per minute, as { minutes, seconds, text }. */
    function duration(words, wpm) {
        var pace = wpm > 0 ? wpm : 1;
        var total = Math.round((words / pace) * 60);
        var m = Math.floor(total / 60), sec = total % 60;
        var text;
        if (!words) text = '0 sec';
        else if (total < 1) text = 'under 1 sec';
        else if (m === 0) text = sec + ' sec';
        else text = m + ' min' + (sec ? ' ' + sec + ' sec' : '');
        return { minutes: total / 60, seconds: total, text: text };
    }

    /** The most used words, lower-cased, with counts and share of all words. */
    function topWords(text, limit, skipCommon) {
        var counts = {};
        var list = tokens(text);
        var total = 0;
        for (var i = 0; i < list.length; i++) {
            var w = list[i].toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/’/g, "'");
            if (!w || !/\p{L}/u.test(w)) continue;
            total++;
            if (skipCommon && STOP_SET[w]) continue;
            counts[w] = (counts[w] || 0) + 1;
        }
        return Object.keys(counts)
            .map(function (w) { return { word: w, count: counts[w], share: total ? counts[w] / total : 0 }; })
            .filter(function (x) { return x.count > 1; })
            .sort(function (a, b) { return b.count - a.count || (a.word < b.word ? -1 : 1); })
            .slice(0, limit || 10);
    }

    /** SMS encoding and number of parts (3GPP TS 23.038). */
    function sms(text) {
        var t = text.replace(/\r\n?/g, '\n');
        var gsm = true, len7 = 0;
        for (var i = 0; i < t.length; i++) {
            var ch = t.charAt(i);
            if (GSM_BASIC.indexOf(ch) >= 0) len7 += 1;
            else if (GSM_EXT.indexOf(ch) >= 0) len7 += 2;
            else { gsm = false; break; }
        }
        if (gsm) {
            return { encoding: 'GSM-7', units: len7, parts: len7 === 0 ? 0 : len7 <= 160 ? 1 : Math.ceil(len7 / 153), perPart: len7 <= 160 ? 160 : 153 };
        }
        var len16 = t.length; // UTF-16 code units, what UCS-2 messages count
        return { encoding: 'Unicode', units: len16, parts: len16 <= 70 ? 1 : Math.ceil(len16 / 67), perPart: len16 <= 70 ? 70 : 67 };
    }

    // Limits from each service's own help pages. X: standard accounts (X weighs links as 23 and some scripts as 2).
    var LIMITS = [
        { key: 'x', label: 'X post', max: 280 },
        { key: 'snippet', label: 'Search result description', max: 155, soft: true },
        { key: 'youtube', label: 'YouTube title', max: 100 },
        { key: 'instagram', label: 'Instagram caption', max: 2200 },
    ];

    /**
     * Everything the page shows for a text.
     * opts: { readWpm, speakWpm, top, skipCommon }
     */
    function analyse(text, opts) {
        var t = String(text || '');
        var o = opts || {};
        var words = countWords(t);
        var chars = graphemes(t.replace(/\r\n/g, '\n'));
        var charsNoSpaces = graphemes(t.replace(/\s+/g, ''));
        var limits = LIMITS.map(function (l) {
            return { key: l.key, label: l.label, max: l.max, soft: !!l.soft, used: chars, left: l.max - chars, over: chars > l.max };
        });
        return {
            words: words,
            characters: chars,
            charactersNoSpaces: charsNoSpaces,
            sentences: countSentences(t),
            paragraphs: countParagraphs(t),
            reading: duration(words, o.readWpm || READ_WPM),
            speaking: duration(words, o.speakWpm || SPEAK_WPM),
            averageWordLength: words ? Math.round((charsNoSpaces / words) * 10) / 10 : 0,
            top: topWords(t, o.top || 10, !!o.skipCommon),
            sms: sms(t),
            limits: limits,
        };
    }

    var api = {
        analyse: analyse, countWords: countWords, countSentences: countSentences, countParagraphs: countParagraphs,
        topWords: topWords, sms: sms, duration: duration, graphemes: graphemes, READ_WPM: READ_WPM, SPEAK_WPM: SPEAK_WPM,
        LIMITS: LIMITS
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).wordCount = api;
})(typeof window !== 'undefined' ? window : this);
