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
            const firstDot = before.indexOf('.');
            const raw = before.replace(/[^\d.]/g, '').replace(/\./g, (match, offset, str) => {
                return str.indexOf('.') === offset ? match : '';
            });
            if (raw === '' || raw === '.') {
                el.value = raw;
                return;
            }
            const formatted = formatIndianNumber(raw);
            el.value = formatted;
            // Best-effort cursor restore
            const diff = formatted.length - before.length;
            const newPos = Math.max(0, Math.min(formatted.length, caret + diff));
            try { el.setSelectionRange(newPos, newPos); } catch (e2) { /* noop */ }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => setupIndianInputs());

// Auto-Save Functionality
function initAutoSave(pagePrefix) {
    if (!pagePrefix) {
        console.warn('initAutoSave: No pagePrefix provided');
        return;
    }

    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), select');

    // Load saved values
    inputs.forEach(input => {
        if (!input.id) return; // Skip inputs without ID

        const key = `${pagePrefix}_${input.id}`;
        const savedValue = localStorage.getItem(key);

        if (savedValue !== null) {
            // Handle checkboxes specifically if needed, though most here are numbers/text
            if (input.type === 'checkbox') {
                input.checked = (savedValue === 'true');
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
