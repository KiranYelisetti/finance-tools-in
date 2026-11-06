/*
 * Image resizer sizing maths for /image-resizer/. No DOM, no canvas: the page does the drawing.
 * Works in the browser as QTCalc.imageResizer and in Node via require(). Tested by tests/unit.
 */
(function (root) {
    'use strict';

    // Output size. mode 'percentage' scales the original by the slider value (whole %), any other mode uses the
    // typed width and height, falling back to the original for a missing or zero value.
    function targetSize(mode, original, percentageValue, widthValue, heightValue) {
        if (mode === 'percentage') {
            var p = parseInt(percentageValue) / 100;
            return { width: Math.round(original.width * p), height: Math.round(original.height * p) };
        }
        return {
            width: parseInt(widthValue) || original.width,
            height: parseInt(heightValue) || original.height
        };
    }

    // With the aspect ratio kept: the other side for a typed side, or null when the typed value is not a
    // positive number. changed is 'width' or 'height'.
    function linkedSide(changed, value, original) {
        var ratio = original.width / original.height;
        var n = parseInt(value);
        if (isNaN(n) || n <= 0) return null;
        return changed === 'width' ? Math.round(n / ratio) : Math.round(n * ratio);
    }

    // "1920,1080" -> { width: 1920, height: 1080 }, or null for no preset
    function parsePreset(value) {
        if (!value) return null;
        var parts = value.split(',').map(Number);
        return { width: parts[0], height: parts[1] };
    }

    function extensionFor(format) {
        if (format === 'image/jpeg') return 'jpg';
        if (format === 'image/webp') return 'webp';
        return 'png';
    }

    // "12.34 KB", or "1.50 MB" above 1 MB
    function fileSizeLabel(bytes) {
        var sizeMB = (bytes / 1024 / 1024).toFixed(2);
        var sizeKB = (bytes / 1024).toFixed(2);
        return sizeMB > 1 ? sizeMB + ' MB' : sizeKB + ' KB';
    }

    var api = { targetSize: targetSize, linkedSide: linkedSide, parsePreset: parsePreset, extensionFor: extensionFor, fileSizeLabel: fileSizeLabel };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).imageResizer = api;
})(typeof window !== 'undefined' ? window : this);
