#!/usr/bin/env node
// Tiny static server for the built site, used by the end-to-end tests (playwright.config.mjs starts and stops it).
// Usage: node scripts/serve-site.mjs --port 8941 --dir _site
// Behaves like GitHub Pages for this site: /about/ serves about/index.html, /about redirects to /about/,
// anything missing is a 404. No dependencies, no request logging.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const port = Number(arg("port", "8941"));
const root = path.resolve(arg("dir", "_site"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function send(res, status, body, type = "text/plain; charset=utf-8", extra = {}) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", ...extra });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    return send(res, 400, "Bad request");
  }
  const file = path.join(root, pathname);
  if (!file.startsWith(root)) return send(res, 403, "Forbidden");

  let stat = null;
  try { stat = fs.statSync(file); } catch { /* missing */ }

  if (stat && stat.isDirectory()) {
    if (!pathname.endsWith("/")) {
      const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      return send(res, 301, "", "text/plain", { Location: pathname + "/" + q });
    }
    const index = path.join(file, "index.html");
    if (fs.existsSync(index)) return send(res, 200, fs.readFileSync(index), TYPES[".html"]);
    return send(res, 404, "Not found");
  }
  if (stat && stat.isFile()) {
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    return send(res, 200, req.method === "HEAD" ? "" : fs.readFileSync(file), type);
  }
  return send(res, 404, "Not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}/`);
});

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
