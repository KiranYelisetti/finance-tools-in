// Tell Bing (and other IndexNow search engines) which pages changed in this deploy.
//
//   node scripts/indexnow.mjs <previously published dir> <new build dir>   submit pages whose HTML changed
//   node scripts/indexnow.mjs --all <new build dir>                        submit every sitemap URL
//   add --dry to only list the URLs
//
// Only URLs listed in the sitemap are considered. Before submitting, it waits until GitHub Pages
// serves the new version, so Bing does not crawl the old page. It never fails the deploy.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HOST = 'www.quicktoolsindia.com';
const KEY = '38e120ba4a50d48ae164b86f9aaebed2';
const dry = process.argv.includes('--dry');
const args = process.argv.slice(2).filter((a) => a !== '--dry');
const all = args[0] === '--all';
const [oldDir, newDir] = all ? [null, args[1]] : args;

// Hash ignoring line endings, so a Windows checkout of the old site does not look changed
const sha = (buf) => createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
const fileFor = (url, dir = newDir) => join(dir, new URL(url).pathname.replace(/^\//, ''), 'index.html');

async function main() {
  const sitemap = readFileSync(join(newDir, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

  const changed = urls.filter((url) => {
    if (all) return true;
    const newFile = fileFor(url);
    const oldFile = fileFor(url, oldDir);
    if (!existsSync(newFile)) return false;
    return !existsSync(oldFile) || sha(readFileSync(newFile)) !== sha(readFileSync(oldFile));
  });
  console.log(`${urls.length} URLs in sitemap, ${changed.length} to submit`);
  if (!changed.length) return;
  changed.forEach((u) => console.log('  ' + u));
  if (dry) return;

  // Wait (up to 5 minutes) for the live site to serve the new build of the first changed page.
  const probe = changed.find((u) => existsSync(fileFor(u)));
  const want = sha(readFileSync(fileFor(probe)));
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(probe, { headers: { 'Cache-Control': 'no-cache' } });
      if (sha(Buffer.from(await res.arrayBuffer())) === want) break;
    } catch { /* retry */ }
    if (i === 29) console.log('Live site still shows the old page after 5 minutes, submitting anyway');
    await new Promise((r) => setTimeout(r, 10000));
  }

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: changed }),
  });
  console.log(`IndexNow answered HTTP ${res.status} ${await res.text()}`.trim());
}

main().catch((e) => console.log('IndexNow step skipped:', e.message));
