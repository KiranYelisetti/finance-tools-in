/*
 * Age maths for /age-calculator/. No DOM. Dates come in as the date fields give them, "YYYY-MM-DD".
 * Works in the browser as QTCalc.age and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    var DAY_MS = 1000 * 60 * 60 * 24;

    // Generation name by birth year
    function generation(birthYear) {
        if (birthYear >= 2013) return 'Gen Alpha (The Future!)';
        if (birthYear >= 1997) return 'Gen Z (Zoomer)';
        if (birthYear >= 1981) return 'Millennial (Gen Y)';
        if (birthYear >= 1965) return 'Gen X';
        if (birthYear >= 1946) return 'Baby Boomer';
        return 'Silent Generation (Respected!)';
    }

    // "36 years, 5 months, 22 days" (parts that are zero are left out)
    function ageText(years, months, days) {
        var text = '';
        if (years > 0) text += years + ' year' + (years > 1 ? 's' : '');
        if (months > 0) text += (text ? ', ' : '') + months + ' month' + (months > 1 ? 's' : '');
        if (days > 0) text += (text ? ', ' : '') + days + ' day' + (days > 1 ? 's' : '');
        return text;
    }

    // Dates are handled as plain calendar days ("YYYY-MM-DD" to a day number), so the answer is the same in every
    // time zone. Dates handed back for display are UTC midnight: format them with timeZone: 'UTC'.
    function parse(s) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
        if (!m) return null;
        return { y: +m[1], m: +m[2], d: +m[3] };
    }
    function dayNumber(x) { return Date.UTC(x.y, x.m - 1, x.d) / DAY_MS; }
    function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
    // Day number of the same day k months later. A day the target month lacks rolls into the next month
    // (31 Jan + 1 month = 3 Mar in 2026), the same rule that puts a 29 Feb birthday on 1 Mar in other years.
    function addMonths(x, k) {
        return Date.UTC(x.y, x.m - 1 + k, x.d) / DAY_MS;
    }
    function utcDate(dayNum) { return new Date(dayNum * DAY_MS); }

    // Returns { error: 'missing' } when a date is empty, { error: 'future' } when the birth date is after the
    // 'as on' date, otherwise the age and the extras the page shows.
    function calculate(birthDateInput, currentDateInput) {
        if (!birthDateInput || !currentDateInput) return { error: 'missing' };
        var b = parse(birthDateInput), c = parse(currentDateInput);
        if (!b || !c) return { error: 'missing' };
        var bDay = dayNumber(b), cDay = dayNumber(c);
        if (bDay > cDay) return { error: 'future' };

        // Whole months first (the last monthly anniversary on or before the 'as on' date), then the days after it
        var k = (c.y * 12 + c.m) - (b.y * 12 + b.m);
        while (k > 0 && addMonths(b, k) > cDay) k--;
        var years = Math.floor(k / 12);
        var months = k % 12;
        var days = cDay - addMonths(b, k);

        var totalDays = cDay - bDay;
        var totalHours = totalDays * 24;

        // Next birthday on or after the 'as on' date (0 days on the birthday itself). 29 Feb falls on 1 Mar in other years.
        function birthdayIn(y) {
            if (b.m === 2 && b.d === 29 && !isLeap(y)) return { y: y, m: 3, d: 1 };
            return { y: y, m: b.m, d: b.d };
        }
        var next = birthdayIn(c.y);
        if (dayNumber(next) < cDay) next = birthdayIn(c.y + 1);
        var daysUntilBirthday = dayNumber(next) - cDay;

        // The next round milestone: 10,000 days, 20,000, 30,000 and on, never one already passed
        var milestoneDays = Math.max(1, Math.ceil(totalDays / 10000)) * 10000;

        return {
            years: years,
            months: months,
            days: days,
            totalDays: totalDays,
            totalWeeks: Math.floor(totalDays / 7),
            totalMonths: k,
            totalHours: totalHours,
            totalMinutes: totalHours * 60,
            text: ageText(years, months, days),
            nextBirthday: utcDate(dayNumber(next)),
            daysUntilBirthday: daysUntilBirthday,
            generation: generation(b.y),
            milestoneDays: milestoneDays,
            milestoneDate: utcDate(bDay + milestoneDays)
        };
    }

    // Today as "YYYY-MM-DD" in the visitor's own time zone (toISOString would give the UTC date, a day behind in
    // India between midnight and 5:30 am)
    function todayLocal(now) {
        var d = now || new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    var api = { calculate: calculate, generation: generation, ageText: ageText, todayLocal: todayLocal };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).age = api;
})(typeof window !== 'undefined' ? window : this);
