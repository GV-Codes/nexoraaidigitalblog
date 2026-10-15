// Builds ./public from ./src (home page, assets) and ./content (posts, pages, images).
// Zero dependencies. Vercel runs this automatically (see vercel.json).
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src');
const CONTENT = path.join(ROOT, 'content');
const PUB = path.join(ROOT, 'public');

const SITE_NAME = 'Nexora AI Digital';
const TAGLINE = "Explore AI. Decode Technology. Create What's Next.";
const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/+$/, '');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '');

// ---------- tiny Markdown -> HTML (headings, lists, tables, quotes, code, links, images) ----------
function inlineMd(src) {
  const codes = [];
  let t = src.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  t = esc(t);
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy"/>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${esc(codes[i])}</code>`);
}
function md(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = [];
  const startsBlock = (l) => /^(#{1,4}\s|>|```|\s*[-*]\s+|\s*\d+[.)]\s+|-{3,}$)/.test(l);
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    let m;
    if (/^```/.test(l)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
    } else if (!l.trim()) {
      i++;
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) {
      out.push(`<h${m[1].length}>${inlineMd(m[2])}</h${m[1].length}>`);
      i++;
    } else if (/^(-{3,}|\*{3,})\s*$/.test(l)) {
      out.push('<hr />');
      i++;
    } else if (/^>/.test(l)) {
      const q = [];
      while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${md(q.join('\n'))}</blockquote>`);
    } else if (/^\s*[-*]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {
      const ordered = /^\s*\d+[.)]\s+/.test(l);
      const re = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
      const items = [];
      while (i < lines.length && re.test(lines[i])) items.push(`<li>${inlineMd(lines[i++].replace(re, ''))}</li>`);
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
    } else if (l.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(l);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inlineMd(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) para.push(lines[i++]);
      if (!para.length) para.push(lines[i++]);
      out.push(`<p>${inlineMd(para.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}
function plainText(html, max = 160) {
  const t = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}
function fromMarkdownFile(name, raw) {
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(raw.replace(/\r/g, ''));
  const meta = {};
  if (fm) for (const line of fm[1].split('\n')) { const k = /^([\w-]+):\s*(.*)$/.exec(line); if (k) meta[k[1]] = k[2].trim().replace(/^["']|["']$/g, ''); }
  const body = fm ? raw.replace(/\r/g, '').slice(fm[0].length) : raw;
  const html = md(body);
  const date = meta.date ? new Date(meta.date).toISOString() : new Date().toISOString();
  return {
    title: meta.title || name,
    slug: meta.slug || name,
    oldPath: '',
    published: date,
    updated: date,
    labels: (meta.labels || '').split(',').map((s) => s.trim()).filter(Boolean),
    image: meta.image || '',
    summary: meta.summary || plainText(html),
    html,
  };
}

async function readJsonDir(dir) {
  let names = [];
  try { names = await fs.readdir(dir); } catch { return []; }
  const items = [];
  for (const n of names) {
    const file = path.join(dir, n);
    if (n.endsWith('.json')) items.push(JSON.parse(await fs.readFile(file, 'utf8')));
    else if (n.endsWith('.md')) items.push(fromMarkdownFile(n.replace(/\.md$/, ''), await fs.readFile(file, 'utf8')));
  }
  return items;
}
async function write(rel, data) {
  const file = path.join(PUB, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

const CSS = `
:root{--amber:#f6b55c;--amber2:#e58a3a;--ink:#efe6dc;--mute:#a99fb0;--line:rgba(255,255,255,.1)}
*{box-sizing:border-box;margin:0;padding:0}
html{background:#0f0c16}
body{min-height:100vh;color:var(--ink);font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.7;
  background:radial-gradient(120% 80% at 20% -10%,#2a1c40 0,#0f0c16 55%) fixed}
a{color:var(--amber)}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;max-width:1000px;margin:0 auto}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink)}
.logo{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-weight:800;color:#2a1a0c;background:linear-gradient(135deg,var(--amber),var(--amber2));font-family:'Fraunces',Georgia,serif}
.brand b{font-family:'Fraunces',Georgia,serif;font-size:15px}
.nav{display:flex;gap:8px;flex-wrap:wrap}
.pill{padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.05);font-size:13px;text-decoration:none;color:var(--ink)}
.pill:hover{background:rgba(255,255,255,.12)}
main{max-width:760px;margin:0 auto;padding:18px 20px 60px}
.eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--amber)}
h1.title{font-family:'Fraunces',Georgia,serif;font-size:clamp(28px,5vw,42px);line-height:1.15;font-weight:600;margin:8px 0 10px}
.meta{font-size:13px;color:var(--mute);display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:22px}
.tag{padding:2px 10px;border-radius:999px;border:1px solid rgba(246,181,92,.5);background:rgba(246,181,92,.12);color:#ffd9a3;font-size:12px;text-decoration:none}
.article{background:rgba(16,12,24,.62);border:1px solid var(--line);border-radius:20px;padding:clamp(18px,4vw,34px);backdrop-filter:blur(10px)}
.article h1,.article h2,.article h3,.article h4{font-family:'Fraunces',Georgia,serif;font-weight:600;line-height:1.25;margin:1.6em 0 .5em}
.article h1{font-size:28px}.article h2{font-size:24px}.article h3{font-size:19px}
.article>*:first-child{margin-top:0}
.article p,.article ul,.article ol,.article blockquote,.article table,.article .separator{margin:0 0 1em}
.article ul,.article ol{padding-left:1.4em}.article li{margin:.2em 0}
.article blockquote{border-left:3px solid var(--amber);padding:.4em 1em;background:rgba(246,181,92,.08);border-radius:0 12px 12px 0}
.article hr{border:0;border-top:1px solid var(--line);margin:1.6em 0}
.article img{max-width:100%;height:auto;border-radius:12px;display:inline-block}
.article .separator{text-align:center}
.article iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:12px}
.article table{display:block;overflow-x:auto;border-collapse:collapse}
.article th,.article td{border:1px solid var(--line);padding:8px 12px;text-align:left}
.article th{background:rgba(255,255,255,.06)}
.article pre,.article code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em}
.article pre{background:rgba(0,0,0,.35);padding:12px 14px;border-radius:12px;overflow-x:auto;margin:0 0 1em}
.pager{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px}
.pager a{display:block;padding:14px 16px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);text-decoration:none;color:var(--ink);font-size:14px}
.pager a small{display:block;color:var(--mute);font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:2px}
.pager a:hover{background:rgba(255,255,255,.1)}
.pager .next{text-align:right}
footer{text-align:center;font-size:10px;letter-spacing:.22em;color:#7d7388;padding:24px 0 34px}
.list{list-style:none;display:grid;gap:12px}
.list a.card{display:flex;gap:14px;padding:14px;border-radius:16px;border:1px solid var(--line);background:rgba(16,12,24,.62);text-decoration:none;color:var(--ink)}
.list a.card:hover{background:rgba(255,255,255,.08)}
.list .thumb{width:84px;height:84px;flex:none;border-radius:10px;background:#3a3046 center/cover no-repeat}
.list h2{font-family:'Fraunces',Georgia,serif;font-size:18px;line-height:1.25;margin-bottom:2px}
.list p{font-size:13px;color:var(--mute);line-height:1.5}
.filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}
.filters button{padding:5px 12px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:#d8cfdf;font:inherit;font-size:12px;cursor:pointer}
.filters button.on{background:rgba(246,181,92,.2);border-color:rgba(246,181,92,.6);color:#ffd9a3}
`;

function layout({ title, description, canonical, image, body, extraHead = '' }) {
  const fullTitle = title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`;
  const abs = (u) => (u && u.startsWith('/') && SITE_URL ? SITE_URL + u : u);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || TAGLINE)}"/>
${canonical ? `<link rel="canonical" href="${esc(canonical)}"/>` : ''}
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description || TAGLINE)}"/>
<meta property="og:type" content="article"/>
${image ? `<meta property="og:image" content="${esc(abs(image))}"/>` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}"/>
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME}" href="/feed.xml"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="crossorigin"/>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<style>${CSS}</style>
${extraHead}
</head>
<body>
<header class="top">
  <a class="brand" href="/"><span class="logo">N</span><b>${SITE_NAME}</b></a>
  <nav class="nav"><a class="pill" href="/">Reading room</a><a class="pill" href="/posts/">All posts</a><a class="pill" href="/feed.xml">RSS</a></nav>
</header>
${body}
<footer>MADE FOR SLOW MOMENTS &#183; POWERED BY CURIOSITY</footer>
</body>
</html>
`;
}

function postPage(post, prev, next) {
  const url = `/posts/${post.slug}/`;
  const labels = (post.labels || []).map((l) => `<a class="tag" href="/posts/?label=${encodeURIComponent(l)}">${esc(l)}</a>`).join('');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.published,
    dateModified: post.updated || post.published,
    author: { '@type': 'Organization', name: SITE_NAME },
    ...(post.image ? { image: (post.image.startsWith('/') && SITE_URL ? SITE_URL : '') + post.image } : {}),
    description: post.summary,
  };
  const pager = `<nav class="pager">${
    prev ? `<a class="prev" href="/posts/${prev.slug}/"><small>&larr; Newer</small>${esc(prev.title)}</a>` : '<span></span>'
  }${next ? `<a class="next" href="/posts/${next.slug}/"><small>Older &rarr;</small>${esc(next.title)}</a>` : '<span></span>'}</nav>`;
  return layout({
    title: post.title,
    description: post.summary,
    canonical: SITE_URL ? SITE_URL + url : '',
    image: post.image,
    extraHead: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    body: `<main>
  <div class="eyebrow">Nexora reading nook</div>
  <h1 class="title">${esc(post.title)}</h1>
  <div class="meta"><time datetime="${esc(post.published)}">${fmtDate(post.published)}</time>${labels}</div>
  <article class="article">${post.html}</article>
  ${pager}
</main>`,
  });
}

function pagePage(page) {
  return layout({
    title: page.title,
    description: page.summary,
    canonical: SITE_URL ? `${SITE_URL}/${page.slug}/` : '',
    body: `<main><h1 class="title">${esc(page.title)}</h1><article class="article">${page.html}</article></main>`,
  });
}

function listPage(posts) {
  const items = posts
    .map((p) => {
      const thumb = p.image ? `<div class="thumb" style="background-image:url('${esc(p.image)}')"></div>` : '<div class="thumb"></div>';
      return `<li data-labels="${esc((p.labels || []).join('|'))}"><a class="card" href="/posts/${p.slug}/">${thumb}<div><h2>${esc(p.title)}</h2><div class="meta" style="margin:0 0 4px">${fmtDate(p.published)}</div><p>${esc(p.summary)}</p></div></a></li>`;
    })
    .join('\n');
  const labelSet = [...new Set(posts.flatMap((p) => p.labels || []))].sort();
  return layout({
    title: 'All posts',
    description: TAGLINE,
    canonical: SITE_URL ? SITE_URL + '/posts/' : '',
    body: `<main>
  <div class="eyebrow">Archive</div>
  <h1 class="title">All posts</h1>
  <div class="filters" id="filters"><button class="on" data-l="">All</button>${labelSet.map((l) => `<button data-l="${esc(l)}">${esc(l)}</button>`).join('')}</div>
  <ul class="list" id="list">${items}</ul>
</main>
<script>
(function(){
  var bs=document.querySelectorAll('#filters button'),lis=document.querySelectorAll('#list li');
  function apply(l){
    for(var i=0;i<bs.length;i++){bs[i].className=bs[i].getAttribute('data-l')===l?'on':'';}
    for(var j=0;j<lis.length;j++){var ls=lis[j].getAttribute('data-labels').split('|');lis[j].style.display=(!l||ls.indexOf(l)>-1)?'':'none';}
  }
  for(var k=0;k<bs.length;k++){bs[k].onclick=function(){apply(this.getAttribute('data-l'));};}
  var m=/[?&]label=([^&]+)/.exec(location.search);apply(m?decodeURIComponent(m[1].replace(/\\+/g,' ')):'');
})();
</script>`,
  });
}

function rss(posts) {
  const base = SITE_URL || '';
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${base}/posts/${p.slug}/</link>
    <guid isPermaLink="true">${base}/posts/${p.slug}/</guid>
    <pubDate>${new Date(p.published).toUTCString()}</pubDate>
    ${(p.labels || []).map((l) => `<category>${esc(l)}</category>`).join('')}
    <description>${esc(p.summary)}</description>
    <content:encoded><![CDATA[${p.html.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></content:encoded>
  </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${SITE_NAME}</title>
  <link>${base}/</link>
  <description>${esc(TAGLINE)}</description>
${items}
</channel>
</rss>
`;
}

function sitemap(posts, pages) {
  if (!SITE_URL) return '';
  const urls = [
    { loc: '/', lastmod: posts[0] && (posts[0].updated || posts[0].published) },
    { loc: '/posts/' },
    ...posts.map((p) => ({ loc: `/posts/${p.slug}/`, lastmod: p.updated || p.published })),
    ...pages.map((p) => ({ loc: `/${p.slug}/`, lastmod: p.updated || p.published })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

async function main() {
  const loadPosts = async () =>
    (await readJsonDir(path.join(CONTENT, 'posts'))).sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  let posts = await loadPosts();
  if (!posts.length) {
    // Nothing committed yet: pull the posts straight from Blogger during this build.
    console.log('No posts in ./content/posts - exporting them from Blogger first...');
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'export.mjs')], { stdio: 'inherit' });
    } catch {
      /* export.mjs already printed the reason */
    }
    posts = await loadPosts();
  }
  if (!posts.length) {
    console.error('No posts found. Run "node export.mjs" locally and commit the ./content folder.');
    process.exit(1);
  }
  const pages = await readJsonDir(path.join(CONTENT, 'pages'));

  await fs.rm(PUB, { recursive: true, force: true });
  await fs.cp(SRC, PUB, { recursive: true });
  try { await fs.cp(path.join(CONTENT, 'images'), path.join(PUB, 'img'), { recursive: true }); } catch { /* no images */ }

  await write(
    'posts.json',
    JSON.stringify(
      posts.map((p) => ({ title: p.title, url: `/posts/${p.slug}/`, labels: p.labels || [], image: p.image || '', summary: p.summary || '', published: p.published })),
    ),
  );
  for (let i = 0; i < posts.length; i++) {
    await write(`posts/${posts[i].slug}/index.html`, postPage(posts[i], posts[i - 1], posts[i + 1]));
  }
  await write('posts/index.html', listPage(posts));
  for (const page of pages) await write(`${page.slug}/index.html`, pagePage(page));
  await write('feed.xml', rss(posts));
  await write('robots.txt', `User-agent: *\nAllow: /\n${SITE_URL ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ''}`);
  const map = sitemap(posts, pages);
  if (map) await write('sitemap.xml', map);

  console.log(`Built ${posts.length} posts and ${pages.length} pages into ./public`);
  if (!SITE_URL) console.log('Tip: set SITE_URL (e.g. https://yourdomain.com) to add canonical links and sitemap.xml.');
}
main().catch((e) => { console.error(e); process.exit(1); });
