/*
 * PDF work for /jpg-to-pdf/ and /merge-pdf/. No DOM. pdf-lib is passed in (the browser uses the vendored copy in
 * /js/vendor, the unit tests use the same version from node_modules), so everything here runs in Node too.
 * Works in the browser as QTCalc.pdfTools and in Node via require(). Tested by tests/unit.
 *
 * Page sizes are in PDF points (1/72 inch): A4 is 595.28 x 841.89 (210 x 297 mm), US Letter is 612 x 792
 * (8.5 x 11 inches). "Fit to image" makes each page the size of its picture at 96 pixels per inch, the size it shows
 * at on a screen at 100% zoom.
 */
(function (root) {
    'use strict';

    var SIZES = { a4: { w: 595.28, h: 841.89 }, letter: { w: 612, h: 792 } };
    var MARGINS = { none: 0, small: 18, large: 36 }; // a quarter inch and half an inch
    var PX_TO_PT = 72 / 96;

    /**
     * Where an image goes on its page.
     * opts: { size: 'a4' | 'letter' | 'fit', orientation: 'auto' | 'portrait' | 'landscape', margin: 'none' | 'small' | 'large' }
     * Returns page width and height and the image box { x, y, w, h } in points, the image scaled to fit and centred.
     */
    function placement(imgW, imgH, opts) {
        var o = opts || {};
        var m = MARGINS[o.margin] != null ? MARGINS[o.margin] : MARGINS.small;
        if (!(imgW > 0) || !(imgH > 0)) throw new Error('Image has no size');
        if (o.size === 'fit') {
            var w = imgW * PX_TO_PT, h = imgH * PX_TO_PT;
            return { pageW: w + 2 * m, pageH: h + 2 * m, x: m, y: m, w: w, h: h };
        }
        var base = SIZES[o.size] || SIZES.a4;
        var landscape = o.orientation === 'landscape' || (o.orientation !== 'portrait' && imgW > imgH);
        var pageW = landscape ? base.h : base.w;
        var pageH = landscape ? base.w : base.h;
        var boxW = pageW - 2 * m, boxH = pageH - 2 * m;
        var scale = Math.min(boxW / imgW, boxH / imgH);
        var dw = imgW * scale, dh = imgH * scale;
        return { pageW: pageW, pageH: pageH, x: (pageW - dw) / 2, y: (pageH - dh) / 2, w: dw, h: dh };
    }

    /** 'jpg', 'png', 'pdf' or null, from the first bytes of a file. */
    function sniff(bytes) {
        var b = bytes;
        if (!b || b.length < 4) return null;
        if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
        if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
        // %PDF- may follow a little junk at the start, which readers allow
        var head = '';
        for (var i = 0; i < Math.min(b.length, 1024); i++) head += String.fromCharCode(b[i]);
        if (head.indexOf('%PDF-') >= 0) return 'pdf';
        return null;
    }

    /**
     * The EXIF orientation of a JPEG (1 to 8), 1 when there is none. Phones store photos sideways and set this tag
     * so viewers turn them upright. 1 is upright, 3 is upside down, 6 and 8 are turned a quarter, 2, 4, 5, 7 mirrored.
     */
    function exifOrientation(bytes) {
        var b = bytes;
        if (sniff(b) !== 'jpg') return 1;
        var i = 2;
        while (i + 4 < b.length) {
            if (b[i] !== 0xff) return 1;
            var marker = b[i + 1];
            var len = (b[i + 2] << 8) | b[i + 3];
            if (marker === 0xda || marker === 0xd9) return 1; // image data starts: no EXIF before it
            if (marker === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
                var t = i + 10; // start of the TIFF header after "Exif\0\0"
                var le = b[t] === 0x49;
                var u16 = function (p) { return le ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1]; };
                var u32 = function (p) { return le ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0 : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0; };
                var ifd = t + u32(t + 4);
                var n = u16(ifd);
                for (var k = 0; k < n; k++) {
                    var e = ifd + 2 + k * 12;
                    if (e + 12 > b.length) return 1;
                    if (u16(e) === 0x0112) {
                        var v = u16(e + 8);
                        return v >= 1 && v <= 8 ? v : 1;
                    }
                }
                return 1;
            }
            i += 2 + len;
        }
        return 1;
    }

    /**
     * One PDF from images. images: [{ bytes: Uint8Array, type: 'jpg' | 'png' }] in page order. Returns PDF bytes.
     * onProgress(done, total) is called after each page.
     */
    async function imagesToPdf(PDFLib, images, opts, onProgress) {
        var doc = await PDFLib.PDFDocument.create();
        doc.setProducer('QuickTools Plus JPG to PDF');
        doc.setCreator('QuickTools Plus');
        for (var i = 0; i < images.length; i++) {
            var it = images[i];
            var img = it.type === 'png' ? await doc.embedPng(it.bytes) : await doc.embedJpg(it.bytes);
            var p = placement(img.width, img.height, opts);
            var page = doc.addPage([p.pageW, p.pageH]);
            page.drawImage(img, { x: p.x, y: p.y, width: p.w, height: p.h });
            if (onProgress) onProgress(i + 1, images.length);
        }
        return doc.save();
    }

    /** Why a PDF cannot be used: 'encrypted', 'broken' or null when it opened. */
    function failureKind(err) {
        var s = String((err && (err.name + ' ' + err.message)) || err);
        return /encrypt/i.test(s) ? 'encrypted' : 'broken';
    }

    /** Open a PDF: { ok: true, doc, pages } or { ok: false, kind: 'encrypted' | 'broken' | 'empty' | 'not-pdf' }. */
    async function openPdf(PDFLib, bytes) {
        if (sniff(bytes) !== 'pdf') return { ok: false, kind: 'not-pdf' };
        try {
            var doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
            var pages = doc.getPageCount();
            if (!pages) return { ok: false, kind: 'empty' };
            return { ok: true, doc: doc, pages: pages };
        } catch (e) {
            return { ok: false, kind: failureKind(e) };
        }
    }

    /** One PDF from several opened ones, every page in order. docs: PDFDocument[] from openPdf. Returns PDF bytes. */
    async function mergeDocs(PDFLib, docs, onProgress) {
        var out = await PDFLib.PDFDocument.create();
        out.setProducer('QuickTools Plus Merge PDF');
        out.setCreator('QuickTools Plus');
        for (var i = 0; i < docs.length; i++) {
            var pages = await out.copyPages(docs[i], docs[i].getPageIndices());
            for (var j = 0; j < pages.length; j++) out.addPage(pages[j]);
            if (onProgress) onProgress(i + 1, docs.length);
        }
        return out.save();
    }

    /** Move an item in a list: returns a new array with list[from] moved to index `to`. */
    function move(list, from, to) {
        var a = list.slice();
        if (from < 0 || from >= a.length || to < 0 || to >= a.length || from === to) return a;
        var item = a.splice(from, 1)[0];
        a.splice(to, 0, item);
        return a;
    }

    var api = {
        placement: placement, sniff: sniff, exifOrientation: exifOrientation, imagesToPdf: imagesToPdf,
        openPdf: openPdf, mergeDocs: mergeDocs, move: move, SIZES: SIZES, MARGINS: MARGINS
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else (root.QTCalc = root.QTCalc || {}).pdfTools = api;
})(typeof window !== 'undefined' ? window : this);
