// Layout audit that runs inside the page. It finds what a person would call "broken alignment": text drawn on top of
// other text, controls on top of each other, content pushed off the side of the screen, text cut off by its box,
// controls too small to tap, and a page column that is not centred on a wide screen.
// Used by tests/e2e/layout.spec.mjs. Kept free of site-specific selectors so other sites can copy it.

/** Widths in CSS pixels. Browser zoom on a 1366 px laptop is the same as a narrower or wider viewport:
 *  400% = 341, 300% = 455, 200% = 683, 150% = 911, 125% = 1093, 80% = 1707, 67% = 2039, 50% = 2732. */
export const ZOOM_WIDTHS = [
  { width: 280, label: "folded phone 280" },
  { width: 320, label: "small phone 320" },
  { width: 341, label: "laptop at 400% zoom (341)" },
  { width: 360, label: "Android phone 360" },
  { width: 390, label: "iPhone 390" },
  { width: 430, label: "large iPhone 430" },
  { width: 455, label: "laptop at 300% zoom (455)" },
  { width: 683, label: "laptop at 200% zoom (683)" },
  { width: 768, label: "tablet 768" },
  { width: 911, label: "laptop at 150% zoom (911)" },
  { width: 1024, label: "tablet landscape 1024" },
  { width: 1093, label: "laptop at 125% zoom (1093)" },
  { width: 1366, label: "laptop 1366" },
  { width: 1707, label: "laptop at 80% zoom (1707)" },
  { width: 2039, label: "laptop at 67% zoom (2039)" },
  { width: 2732, label: "laptop at 50% zoom (2732)" },
];

/**
 * In-page audit. Pass it to page.evaluate. Returns a list of problems (strings), empty when the layout is clean.
 * opts.ignore: CSS selectors whose elements (and descendants) are skipped, for deliberate overlaps such as a sticker.
 * opts.centred: CSS selector of page columns that must sit in the middle of a wide screen.
 * opts.minTarget: smallest tap target in px (WCAG 2.2 AA 2.5.8 says 24).
 */
export function auditLayout(opts) {
  const { ignore = [], centred = "", minTarget = 24 } = opts || {};
  const problems = [];
  const root = document.documentElement;
  const vw = root.clientWidth;
  const ignored = (el) => ignore.some((s) => el.closest(s));
  const name = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    else if (typeof el.className === "string" && el.className.trim()) s += "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
    const text = (el.innerText || el.getAttribute("aria-label") || el.value || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return text ? `${s} "${text}"` : s;
  };
  const shown = (el) => {
    if (!el.getClientRects().length) return false;
    // The answer inside a closed <details> is not drawn (only its summary is)
    const closed = el.closest("details:not([open])");
    if (closed && !el.closest("summary")) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (Number(getComputedStyle(a).opacity) === 0) return false;
    }
    return true;
  };
  // An ancestor that scrolls or clips sideways: content beyond it is intended (a scrolling table, a ticker).
  const clippedBy = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return a;
    }
    return null;
  };
  // The part of a box that is actually drawn: cut down by every ancestor that clips or scrolls (either axis)
  const visiblePart = (el, r, self = false) => {
    let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
    for (let a = self ? el : el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      const cx = s.overflowX !== "visible", cy = s.overflowY !== "visible";
      if (!cx && !cy) continue;
      const b = a.getBoundingClientRect();
      if (cx) { left = Math.max(left, b.left); right = Math.min(right, b.right); }
      if (cy) { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
    }
    return right - left > 1 && bottom - top > 1 ? { left, top, right, bottom, width: right - left, height: bottom - top } : null;
  };
  // Screen-reader-only text is clipped to a 1 px box on purpose
  const srOnly = (el) => { const r = el.getBoundingClientRect(); return r.width <= 1.5 && r.height <= 1.5; };
  const inFixedLayer = (el) => {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const p = getComputedStyle(a).position;
      if (p === "fixed" || p === "sticky") return a;
    }
    return null;
  };

  // 1. Sideways scroll
  if (root.scrollWidth > vw + 1) problems.push(`page scrolls sideways: ${root.scrollWidth}px wide in a ${vw}px window`);

  // 2. Content off the side of the screen (even when the page hides the scrollbar)
  const all = [...document.querySelectorAll("body *")].filter((el) => !ignored(el) && shown(el) && !srOnly(el));
  const off = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // A closed drawer parked fully outside the window (fixed position) is not on the page
    const layer = inFixedLayer(el);
    if (layer) { const lr = layer.getBoundingClientRect(); if (lr.right <= 0 || lr.left >= vw) continue; }
    if ((r.right > vw + 1 || r.left < -1) && !clippedBy(el)) off.push(`${name(el)} spans ${Math.round(r.left)} to ${Math.round(r.right)}`);
  }
  if (off.length) problems.push(`off the screen (window ${vw}px): ${off.slice(0, 4).join(" | ")}`);

  // 3. Text drawn over other text. Every text node's line boxes are compared with every other's.
  const runs = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim() && n.parentElement && !ignored(n.parentElement) && shown(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const range = document.createRange();
  while (walker.nextNode()) {
    const n = walker.currentNode;
    const tag = n.parentElement.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "OPTION") continue;
    range.selectNodeContents(n);
    for (const raw of range.getClientRects()) {
      if (raw.width < 2 || raw.height < 2) continue;
      // A text node is clipped by its own element too (a label cut short with an ellipsis)
      const r = visiblePart(n.parentElement, raw, true);
      if (r) runs.push({ el: n.parentElement, r, layer: inFixedLayer(n.parentElement) });
    }
  }
  const textHits = new Set();
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i], b = runs[j];
      if (a.el === b.el || a.layer !== b.layer) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      // Line boxes of neighbouring lines touch by a pixel or two, so require a real overlap
      if (w > 3 && h > Math.min(a.r.height, b.r.height) * 0.35) textHits.add(`${name(a.el)} over ${name(b.el)}`);
    }
  }
  if (textHits.size) problems.push(`text over text: ${[...textHits].slice(0, 4).join(" | ")}`);

  // 3b. Badges, icons and other positioned boxes drawn on top of text that is not theirs
  const covered = new Set();
  const painted = all.filter((el) => {
    const s = getComputedStyle(el);
    if (s.position !== "absolute" && s.position !== "fixed") return false;
    const paints = s.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(s.borderTopWidth) > 0 || el.querySelector("svg, img");
    return paints && el.getBoundingClientRect().width > 4;
  });
  for (const box of painted) {
    const b = visiblePart(box, box.getBoundingClientRect());
    if (!b) continue;
    for (const run of runs) {
      if (box.contains(run.el) || run.el.contains(box)) continue;
      // Only what is drawn above the text: the box comes later in the page or sits higher in the stack
      if (!(box.compareDocumentPosition(run.el) & Node.DOCUMENT_POSITION_PRECEDING) && getComputedStyle(box).zIndex === "auto") continue;
      const w = Math.min(b.right, run.r.right) - Math.max(b.left, run.r.left);
      const h = Math.min(b.bottom, run.r.bottom) - Math.max(b.top, run.r.top);
      if (w > 3 && h > run.r.height * 0.35) covered.add(`${name(box)} covers ${name(run.el)}`);
    }
  }
  if (covered.size) problems.push(`text hidden under a badge or icon: ${[...covered].slice(0, 4).join(" | ")}`);

  // 4. Controls on top of each other
  const controls = all.filter((el) => el.matches("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], summary"));
  const ctrlHits = [];
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (inFixedLayer(a) !== inFixedLayer(b)) continue;
      // Per line box: a link that wraps onto two lines is two boxes, not one big rectangle
      let hit = false;
      for (const ra of a.getClientRects()) for (const rb of b.getClientRects()) {
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 4 && h > 4) hit = true;
      }
      if (hit) ctrlHits.push(`${name(a)} over ${name(b)}`);
    }
  }
  if (ctrlHits.length) problems.push(`controls overlap: ${ctrlHits.slice(0, 4).join(" | ")}`);

  // 5. Text cut off by its own box (overflow hidden with more text than fits, and no ellipsis meant)
  const cut = [];
  for (const el of all) {
    const s = getComputedStyle(el);
    if (!/(hidden|clip)/.test(s.overflowX) || s.textOverflow === "ellipsis") continue;
    if (!el.innerText || !el.innerText.trim() || srOnly(el)) continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      // Content wider than the box is fine when it is a scroller's track (ticker) marked as decoration
      if (el.querySelector("[aria-hidden='true']") && el.scrollWidth > el.clientWidth * 1.8) continue;
      cut.push(`${name(el)} (${el.scrollWidth}px of text in ${el.clientWidth}px)`);
    }
  }
  if (cut.length) problems.push(`text cut off: ${cut.slice(0, 4).join(" | ")}`);

  // 6. Tap targets smaller than minTarget, with the WCAG 2.5.8 exceptions: links inside running text, and a small
  // target that has room around it (a minTarget circle on its centre touches no other target)
  const small = [];
  const boxes = controls.map((el) => el.getBoundingClientRect());
  for (let i = 0; i < controls.length; i++) {
    const el = controls[i], r = boxes[i];
    if (el.matches("input[type=range]")) continue;
    if (el.matches("a") && getComputedStyle(el).display === "inline") continue;
    if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")) continue;
    if (r.width >= minTarget - 0.5 && r.height >= minTarget - 0.5) continue;
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, rad = minTarget / 2;
    const crowded = boxes.some((o, j) => {
      if (j === i || controls[j].contains(el) || el.contains(controls[j])) return false;
      const dx = Math.max(o.left - cx, 0, cx - o.right), dy = Math.max(o.top - cy, 0, cy - o.bottom);
      return dx * dx + dy * dy < rad * rad;
    });
    if (crowded) small.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  if (small.length) problems.push(`tap targets under ${minTarget}px: ${small.slice(0, 4).join(" | ")}`);

  // 7. Page columns centred on wide screens (the "empty right side" fault), measured inside the parent's box so a
  // sidebar layout counts the space beside the sidebar, not the whole window
  if (centred && vw >= 1600) {
    for (const el of document.querySelectorAll(centred)) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      const box = el.parentElement.getBoundingClientRect();
      const left = r.left - box.left, right = Math.min(box.right, vw) - r.right;
      if (Math.abs(left - right) > 4 && r.width < box.width - 8) problems.push(`${name(el)} not centred: ${Math.round(left)}px left, ${Math.round(right)}px right`);
    }
  }
  return problems;
}
