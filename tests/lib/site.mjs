// What the build produced: every HTML page in _site, split into real pages and the old .html redirect stubs.
// Run `npm run build` first (npm run test:e2e does).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SITE_DIR = fileURLToPath(new URL("../../_site/", import.meta.url));

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function urlFor(file) {
  const rel = path.relative(SITE_DIR, file).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return "/" + rel.slice(0, -"index.html".length);
  return "/" + rel;
}

function load() {
  if (!fs.existsSync(SITE_DIR)) throw new Error("_site is missing. Run npm run build first.");
  const pages = [];
  const redirects = [];
  for (const file of walk(SITE_DIR).sort()) {
    const html = fs.readFileSync(file, "utf8");
    const url = urlFor(file);
    const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1].trim();
    const refresh = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/i);
    if (refresh) redirects.push({ url, file, target: refresh[1] });
    else pages.push({ url, file, title });
  }
  return { pages, redirects };
}

export const { pages, redirects } = load();

/** Paths a link may point at: every page URL, the redirect stubs, and the static files the build copies. */
export function servedPaths() {
  const set = new Set();
  for (const p of pages) set.add(p.url);
  for (const r of redirects) set.add(r.url);
  const addFiles = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) addFiles(full);
      else set.add("/" + path.relative(SITE_DIR, full).split(path.sep).join("/"));
    }
  };
  addFiles(SITE_DIR);
  return set;
}

/** The tool pages and the label each spec uses. */
export const TOOL_PAGES = [
  "/", "/number-to-words/", "/lakh-crore-in-numbers/", "/home-loan-calculator/", "/car-loan-calculator/",
  "/emi-prepayment-calculator/", "/sip-calculator/", "/ppf-calculator/", "/ssy-calculator/", "/gst-calculator/",
  "/income-tax-calculator/", "/salary-calculator/", "/age-calculator/", "/cash-counter/", "/image-resizer/",
  "/study-abroad-calculator/", "/wedding-cost-calculator/", "/word-counter/",
];
