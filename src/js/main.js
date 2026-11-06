/**
 * QuickTools India Main JavaScript
 * Handles Persistence (Auto-Save) and Social Sharing
 */

// ─── Indian-format currency input helpers ─────────────────────────
// Any <input class="format-inr"> is auto-upgraded from type=number to
// type=text and kept comma-separated as the user types (lakh/crore
// grouping, e.g. 24,00,000). Calculators read values with parseINR()
// which strips commas before parsing.

function formatIndianNumber(num) {
    if (num === null || num === undefined || num === '') return '';
    const n = Number(num);
    if (isNaN(n)) return '';
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function parseINR(value) {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/,/g, '').trim();
    if (cleaned === '') return 0;
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function setupIndianInputs(root) {
    const scope = root || document;
    scope.querySelectorAll('input.format-inr').forEach(input => {
        if (input.dataset.inrReady === '1') return;
        input.dataset.inrReady = '1';

        if (input.type === 'number') {
            input.type = 'text';
            input.setAttribute('inputmode', 'numeric');
            input.setAttribute('autocomplete', 'off');
        }

        // Format initial value
        if (input.value !== '') {
            const initial = parseINR(input.value);
            if (!isNaN(initial)) input.value = formatIndianNumber(initial);
        }

        input.addEventListener('input', (e) => {
            const el = e.target;
            const before = el.value;
            const caret = el.selectionStart ?? before.length;
            // Keep only digits and at most one decimal point
            const raw = before.replace(/[^\d.]/g, '').replace(/\./g, (match, offset, str) => {
                return str.indexOf('.') === offset ? match : '';
            });
            if (raw === '' || raw === '.') {
                el.value = raw;
                return;
            }
            // Group the rupees, keep the paise as typed (up to 2 digits). Formatting the whole number would drop a
            // trailing "." while it is being typed, so "1000.50" typed key by key used to become 1,00,050.
            const dot = raw.indexOf('.');
            const rupees = dot === -1 ? raw : raw.slice(0, dot);
            const formatted = formatIndianNumber(rupees === '' ? '0' : rupees) + (dot === -1 ? '' : '.' + raw.slice(dot + 1, dot + 3));
            el.value = formatted;
            // Best-effort cursor restore
            const diff = formatted.length - before.length;
            const newPos = Math.max(0, Math.min(formatted.length, caret + diff));
            try { el.setSelectionRange(newPos, newPos); } catch (e2) { /* noop */ }
        });

        // Safari (WebKit, so every iPhone browser) skips the change event when a script rewrote the value while
        // typing, which the grouping above does on every key. Pages check limits on change, so send it on blur.
        let atFocus = null;
        let changed = false;
        input.addEventListener('focus', () => { atFocus = input.value; changed = false; });
        input.addEventListener('change', () => { changed = true; });
        input.addEventListener('blur', () => {
            if (!changed && atFocus !== null && input.value !== atFocus) {
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            atFocus = null;
        });
    });
}

document.addEventListener('DOMContentLoaded', () => setupIndianInputs());

// Tables that scroll (sideways or in a short box) must be reachable with the keyboard (WCAG 2.1.1): each scroller gets a tab stop
// and a name taken from its caption or the nearest heading.
function labelScrollers() {
    document.querySelectorAll('.overflow-x-auto, .overflow-y-auto, .overflow-auto, .qt-table-wrap, table, pre').forEach(el => {
        const cs = getComputedStyle(el);
        if (el.hasAttribute('tabindex') || !/(auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY)) return;
        if (!el.matches('table, pre') && !el.querySelector('table, pre')) return;
        const cap = el.querySelector('caption');
        let heading = null;
        for (let n = el; n && !heading; n = n.parentElement) {
            heading = n.querySelector('h2, h3, h4');
            if (heading && !(heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) heading = null;
        }
        const text = (cap ? cap.textContent : heading ? heading.textContent : 'Table').replace(/\s+/g, ' ').trim();
        el.setAttribute('tabindex', '0');
        // A table keeps its table role (it can carry a name itself), anything else becomes a named region
        if (el.tagName !== 'TABLE') el.setAttribute('role', 'region');
        if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-label', text.slice(0, 90));
    });
}
document.addEventListener('DOMContentLoaded', labelScrollers);

// Auto-Save Functionality
function initAutoSave(pagePrefix) {
    if (!pagePrefix) {
        console.warn('initAutoSave: No pagePrefix provided');
        return;
    }

    // Indian-format fields must be text fields before a saved "30,00,000" goes back in: a type=number
    // field silently drops a value with commas. Pages call initAutoSave before main.js's own
    // DOMContentLoaded handler runs, so upgrade them here (it is safe to call twice).
    setupIndianInputs();

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select');

    // Load saved values
    inputs.forEach(input => {
        // Radio buttons are saved per group: the value of the one that is ticked
        if (input.type === 'radio' && input.name) {
            const groupKey = `${pagePrefix}_${input.name}`;
            const saved = localStorage.getItem(groupKey);
            if (saved !== null && input.value === saved && !input.checked) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            input.addEventListener('change', (e) => {
                if (e.target.checked) localStorage.setItem(groupKey, e.target.value);
            });
            return;
        }
        if (!input.id) return; // Skip inputs without ID

        const key = `${pagePrefix}_${input.id}`;
        const savedValue = localStorage.getItem(key);

        if (savedValue !== null) {
            // Handle checkboxes specifically if needed, though most here are numbers/text
            if (input.type === 'checkbox') {
                input.checked = (savedValue === 'true');
            } else if (input.type === 'number') {
                input.value = String(savedValue).replace(/,/g, '');
            } else {
                input.value = savedValue;
            }

            // Trigger input event so charts/calcs update
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Save on interaction
        const saveHandler = (e) => {
            const val = (e.target.type === 'checkbox') ? e.target.checked : e.target.value;
            localStorage.setItem(key, val);
        };

        input.addEventListener('input', saveHandler);
        input.addEventListener('change', saveHandler);
    });
}

// Reset Form Functionality
function resetForm(pagePrefix) {
    if (!confirm('Are you sure you want to reset all fields? This will clear your saved data.')) {
        return;
    }

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select');

    inputs.forEach(input => {
        if (!input.id) return;

        // Clear local storage
        const key = `${pagePrefix}_${input.id}`;
        localStorage.removeItem(key);
        if (input.type === 'radio' && input.name) localStorage.removeItem(`${pagePrefix}_${input.name}`);

        // Reset to default value
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = input.defaultChecked;
        } else if (input.tagName === 'SELECT') {
            // Dropdowns have no defaultValue: go back to the option marked selected in the HTML, else the first one
            const def = Array.from(input.options).find(o => o.defaultSelected) || input.options[0];
            if (def) input.value = def.value;
        } else {
            // Use defaultValue if available, otherwise try some sensible defaults or empty
            input.value = input.defaultValue;
        }

        // Trigger events to update UI/Charts
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Optional: Reload page to ensure clean state if needed, but dispatchEvent should suffice for most
    // location.reload();
}

// WhatsApp Share Functionality
// WhatsApp Share Functionality
function shareResult(title, amountString) {
    const text = `I just calculated my ${title} on QuickTools India! Result: ${amountString}. Check it out here:`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)} ${encodeURIComponent(window.location.href)}`;

    // Track Share Event
    trackEvent('share', {
        method: 'whatsapp',
        content_type: title,
        item_id: title.toLowerCase().replace(/\s+/g, '_')
    });

    window.open(url, '_blank');
}

/**
 * GA4 Event Tracking Helper
 * @param {string} toolName - Name of the calculator/tool
 * @param {number|string} value - Principal amount or key metric
 */
function trackCalculatorUsage(toolName, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'tool_usage', {
            'tool_name': toolName,
            'value': value,
            'currency': 'INR'
        });
        console.log(`GA4 Event - tool_usage: ${toolName}, Value: ${value}`);
    } else {
        console.log(`GA4 Not Loaded - tool_usage: ${toolName}, Value: ${value}`);
    }
}

/**
 * Generic GA4 Event Helper
 * @param {string} eventName
 * @param {object} params
 */
function trackEvent(eventName, params) {
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, params);
    }
}
