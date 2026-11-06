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

    // Returns { error: 'missing' } when a date is empty, { error: 'future' } when the birth date is after the
    // 'as on' date, otherwise the age and the extras the page shows.
    function calculate(birthDateInput, currentDateInput) {
        if (!birthDateInput || !currentDateInput) return { error: 'missing' };

        var birthDate = new Date(birthDateInput);
        var currentDate = new Date(currentDateInput);
        if (birthDate > currentDate) return { error: 'future' };

        var years = currentDate.getFullYear() - birthDate.getFullYear();
        var months = currentDate.getMonth() - birthDate.getMonth();
        var days = currentDate.getDate() - birthDate.getDate();

        // Borrow days from the month before the 'as on' month
        if (days < 0) {
            months--;
            var prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
            days += prevMonth.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        var totalDays = Math.floor((currentDate - birthDate) / DAY_MS);
        var totalHours = totalDays * 24;

        var nextBirthday = new Date(currentDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        if (nextBirthday < currentDate) nextBirthday.setFullYear(currentDate.getFullYear() + 1);
        var daysUntilBirthday = Math.floor((nextBirthday - currentDate) / DAY_MS);

        var milestoneDays = 10000;
        if (totalDays > 10000) milestoneDays = 20000;
        if (totalDays > 20000) milestoneDays = 30000;
        var milestoneDate = new Date(birthDate.getTime() + milestoneDays * 24 * 60 * 60 * 1000);

        return {
            years: years,
            months: months,
            days: days,
            totalDays: totalDays,
            totalWeeks: Math.floor(totalDays / 7),
            totalMonths: years * 12 + months,
            totalHours: totalHours,
            totalMinutes: totalHours * 60,
            text: ageText(years, months, days),
            nextBirthday: nextBirthday,
            daysUntilBirthday: daysUntilBirthday,
            generation: generation(birthDate.getFullYear()),
            milestoneDays: milestoneDays,
            milestoneDate: milestoneDate
        };
    }

    var api = { calculate: calculate, generation: generation, ageText: ageText };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).age = api;
})(typeof window !== 'undefined' ? window : this);
