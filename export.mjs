// One-time export of a Blogger blog into ./content (JSON per post + downloaded images).
// Usage:
//   node export.mjs                          -> fetch live from https://nexoraaidigital.blogspot.com
//   node export.mjs --blog=https://x.blogspot.com
//   node export.mjs --no-images              -> keep images hot-linked to Google (not recommended)
//   node export.mjs --from-file=feed.json    -> read a saved Blogger JSON feed instead of the network
// Needs Node 18+ (built-in fetch). No npm packages.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const BLOG = arg('blog', 'https://nexoraaidigital.blogspot.com').replace(/\/+$/, '');
const FROM_FILE = arg('from-file', '');
const DOWNLOAD_IMAGES = !process.argv.includes('--no-images');

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = {
  posts: path.join(ROOT, 'content', 'posts'),
  pages: path.join(ROOT, 'content', 'pages'),
  images: path.join(ROOT, 'content', 'images'),
};

async function fetchEntries(kind) {
  const entries = [];
  for (let start = 1; ; start += 150) {
    const url = `${BLOG}/feeds/${kind}/default?alt=json&max-results=150&start-index=${start}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    const json = await res.json();
    const batch = (json.feed && json.feed.entry) || [];
    entries.push(...batch);
    if (batch.length < 150) break;
  }
  return entries;
}

// ---------- HTML cleanup: drop Word / editor junk, scripts and inline styles ----------
function clean(html) {
  let h = html || '';
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/<(script|style|object|embed|form)\b[\s\S]*?<\/\1>/gi, '');
  h = h.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (m) => {
    const src = (/src=["']([^"']+)/i.exec(m) || [])[1] || '';
    return /^(https?:)?\/\/(www\.)?(youtube(-nocookie)?\.com|player\.vimeo\.com)\//i.test(src)
      ? `<iframe src="${src.startsWith('//') ? 'https:' + src : src}" loading="lazy" allowfullscreen></iframe>`
      : '';
  });
  h = h.replace(/<\/?o:p>/gi, '');
  h = h.replace(/\s(on\w+|contenteditable|data-[\w-]+|style|face|class)=("[^"]*"|'[^']*')/gi, (m, name, val) =>
    name.toLowerCase() === 'class' && /\bseparator\b/.test(val) ? ' class="separator"' : '',
  );
  h = h.replace(/href=("|')\s*javascript:[^"']*\1/gi, 'href="#"');
  for (let i = 0; i < 3; i++) {
    h = h.replace(/<p>\s*(?:&nbsp;|<br\s*\/?>|\s)*<\/p>/gi, '');
    h = h.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br />');
  }
  h = h.replace(/<span>\s*<\/span>/gi, '');
  return h.trim();
}

function textOf(html, max = 160) {
  const t = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

// ---------- images ----------
const GOOGLE_IMG = /^https?:\/\/(?:[\w-]+\.)?(?:googleusercontent\.com|bp\.blogspot\.com|blogger\.googleusercontent\.com)\//i;
function fullSize(u) {
  if (/=[swh][\w-]*$/i.test(u)) return u.replace(/=[swh][\w-]*$/i, '=s1600');
  if (/\/(?:s|w)\d+(?:-h\d+)?(?:-[a-z]+)?\//i.test(u)) return u.replace(/\/(?:s|w)\d+(?:-h\d+)?(?:-[a-z]+)?\//i, '/s1600/');
  return u;
}
const imageMap = new Map();
let imageFailures = 0;
async function localImage(url) {
  if (!DOWNLOAD_IMAGES || !GOOGLE_IMG.test(url)) return url;
  const big = fullSize(url);
  if (imageMap.has(big)) return imageMap.get(big);
  try {
    const res = await fetch(big);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const type = (res.headers.get('content-type') || '').split(';')[0];
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[type] || 'jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    const name = crypto.createHash('sha1').update(big).digest('hex').slice(0, 12) + '.' + ext;
    await fs.writeFile(path.join(OUT.images, name), buf);
    imageMap.set(big, `/img/${name}`);
  } catch (err) {
    imageFailures++;
    console.warn(`  ! image kept as a link (${err.message}): ${url.slice(0, 80)}`);
    imageMap.set(big, url);
  }
  return imageMap.get(big);
}
async function rewriteImages(html) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) if (GOOGLE_IMG.test(m[1])) urls.add(m[1]);
  let out = html;
  for (const u of urls) {
    const local = await localImage(u);
    out = out.split(u).join(local);
  }
  return out;
}

// ---------- entries -> files ----------
function parse(entry, kind) {
  const alt = (entry.link || []).find((l) => l.rel === 'alternate');
  const href = alt ? alt.href : '';
  const oldPath = href ? new URL(href).pathname : '';
  const slug = (oldPath.split('/').pop() || '').replace(/\.html$/, '') || crypto.createHash('sha1').update(entry.id.$t).digest('hex').slice(0, 8);
  return {
    kind,
    title: (entry.title && entry.title.$t) || 'Untitled',
    slug,
    oldPath,
    published: entry.published && entry.published.$t,
    updated: entry.updated && entry.updated.$t,
    labels: (entry.category || []).map((c) => c.term),
    thumb: entry.media$thumbnail ? entry.media$thumbnail.url : '',
    rawHtml: (entry.content && entry.content.$t) || (entry.summary && entry.summary.$t) || '',
  };
}

async function main() {
  await Promise.all(Object.values(OUT).map((d) => fs.mkdir(d, { recursive: true })));
  let postEntries, pageEntries = [];
  if (FROM_FILE) {
    const json = JSON.parse(await fs.readFile(FROM_FILE, 'utf8'));
    postEntries = (json.feed && json.feed.entry) || [];
    console.log(`Read ${postEntries.length} entries from ${FROM_FILE}`);
  } else {
    console.log(`Fetching posts from ${BLOG} ...`);
    postEntries = await fetchEntries('posts');
    try { pageEntries = await fetchEntries('pages'); } catch { /* blog may have no pages feed */ }
    console.log(`Found ${postEntries.length} posts and ${pageEntries.length} pages`);
  }
  if (!postEntries.length) throw new Error('No posts found. Is the blog public and the site feed enabled?');

  const all = [...postEntries.map((e) => parse(e, 'post')), ...pageEntries.map((e) => parse(e, 'page'))];
  for (const item of all) {
    process.stdout.write(`- ${item.kind}: ${item.title}\n`);
    let html = clean(item.rawHtml);
    html = await rewriteImages(html);
    const first = (/<img[^>]+src=["']([^"']+)["']/i.exec(html) || [])[1];
    const image = first || (item.thumb ? await localImage(item.thumb) : '');
    const record = {
      title: item.title,
      slug: item.slug,
      oldPath: item.oldPath,
      published: item.published,
      updated: item.updated,
      labels: item.labels,
      image,
      summary: textOf(html),
      html,
    };
    const dir = item.kind === 'page' ? OUT.pages : OUT.posts;
    await fs.writeFile(path.join(dir, `${item.slug}.json`), JSON.stringify(record, null, 2));
  }
  console.log(`\nDone. ${postEntries.length} posts, ${pageEntries.length} pages, ${imageMap.size} images (${imageFailures} left as links).`);
  console.log('Next: node build.mjs');
}
main().catch((e) => { console.error('\nExport failed:', e.message); process.exit(1); });
