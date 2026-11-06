/* QuickTools design system behaviour (docs/DESIGN-SYSTEM.md).
   Small and dependency free. Exposes window.qt with helpers that page scripts can call:
     qt.toast(message)                 show a short message at the bottom of the screen
     qt.copy(text, button)             copy text, flip the button to "Copied" for 1.6 s
     qt.countTo(el, value, format)     animate a figure from its last value to a new one
     qt.fill(rangeInput)               repaint a .qt-range track after a script changes its value
   Motion respects prefers-reduced-motion everywhere. */
(function () {
    'use strict';
    var root = document.documentElement;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Theme -------------------------------------------------------- */
    function syncThemeButton() {
        var btn = document.getElementById('themeToggle');
        if (!btn) return;
        var dark = root.classList.contains('dark');
        btn.setAttribute('aria-label', dark ? 'Switch to day mode' : 'Switch to night mode');
        btn.setAttribute('aria-pressed', String(dark));
    }
    function setTheme(dark) {
        root.classList.toggle('dark', dark);
        try { localStorage.setItem('qt-theme', dark ? 'dark' : 'light'); } catch (e) { /* private mode */ }
        syncThemeButton();
    }
    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('#themeToggle');
        if (btn) setTheme(!root.classList.contains('dark'));
    });

    /* ---- Toast -------------------------------------------------------- */
    var toastTimer;
    function toast(message) {
        var el = document.getElementById('qtToast');
        if (!el) return;
        el.textContent = message;
        el.classList.add('is-shown');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('is-shown'); }, 1900);
    }

    /* ---- Copy --------------------------------------------------------- */
    function copy(text, button) {
        function done(ok) {
            if (button) {
                var label = button.getAttribute('data-label') || button.textContent;
                button.setAttribute('data-label', label);
                button.textContent = ok ? 'Copied' : 'Press Ctrl+C';
                button.classList.toggle('is-done', ok);
                setTimeout(function () { button.textContent = label; button.classList.remove('is-done'); }, 1600);
            }
            if (ok) toast('Copied to clipboard');
        }
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
        }
        done(fallbackCopy(text));
        return Promise.resolve();
    }
    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
    }

    /* ---- Count-up figures -------------------------------------------- */
    function countTo(el, value, format) {
        if (!el) return;
        var fmt = format || function (n) { return Math.round(n).toLocaleString('en-IN'); };
        var from = parseFloat(el.getAttribute('data-value'));
        el.setAttribute('data-value', String(value));
        if (reduce || !isFinite(from) || !isFinite(value) || from === value) { el.textContent = fmt(value); return; }
        var start = null;
        var dur = 520;
        if (el._qtFrame) cancelAnimationFrame(el._qtFrame);
        function step(t) {
            if (start === null) start = t;
            var p = Math.min(1, (t - start) / dur);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = fmt(from + (value - from) * eased);
            if (p < 1) el._qtFrame = requestAnimationFrame(step);
            else el.textContent = fmt(value);
        }
        el._qtFrame = requestAnimationFrame(step);
    }

    /* ---- Sliders ------------------------------------------------------ */
    function fill(input) {
        var min = parseFloat(input.min || 0);
        var max = parseFloat(input.max || 100);
        var v = parseFloat(input.value);
        var pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
        input.style.setProperty('--fill', Math.max(0, Math.min(100, pct)) + '%');
    }
    document.addEventListener('input', function (e) {
        if (e.target.classList && e.target.classList.contains('qt-range')) fill(e.target);
    });

    /* ---- Scroll reveal, both directions -------------------------------- */
    function initReveal() {
        var items = document.querySelectorAll('.qt-reveal');
        if (!items.length) return;
        if (reduce || !('IntersectionObserver' in window)) {
            items.forEach(function (el) { el.classList.add('is-in'); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) en.target.classList.add('is-in');
                else if (en.boundingClientRect.top > 0) en.target.classList.remove('is-in');
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        items.forEach(function (el) { io.observe(el); });
    }

    function init() {
        syncThemeButton();
        document.querySelectorAll('.qt-range').forEach(fill);
        initReveal();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.qt = { toast: toast, copy: copy, countTo: countTo, fill: fill, setTheme: setTheme };
})();
