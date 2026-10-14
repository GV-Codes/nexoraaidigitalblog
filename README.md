# Nexora AI Digital: Blogger -> Vercel

Static blog (no framework, no npm packages). Your cozy reading-room home page is `src/index.html`; every
Blogger post becomes its own page at `/posts/<slug>/`, with an RSS feed, sitemap and SEO tags.

## 1. Export your posts (once, on your computer; Node 18+)

    node export.mjs

This downloads all posts, pages and images from https://nexoraaidigital.blogspot.com into `content/`.
Check `content/posts/` has your posts (you have 18). Commit the `content/` folder.

## 2. Preview locally

    node build.mjs
    npx serve public        # or open public/index.html through any static server

## 3. Deploy to Vercel

Option A, GitHub (recommended): push this folder to a new GitHub repo, then on vercel.com choose
Add New > Project > Import. Framework Preset: Other. Vercel reads `vercel.json` (build: `node build.mjs`, output: `public`).

Option B, CLI:

    npm i -g vercel
    vercel            # first deploy (preview)
    vercel --prod     # production

## 4. After it is live

- Add `SITE_URL` (for example https://yourdomain.com) under Project > Settings > Environment Variables, then redeploy. This adds canonical links and sitemap.xml.
- Old Blogger links such as `/2026/08/my-post.html` redirect automatically to `/posts/my-post/` once your custom domain points at Vercel (see `vercel.json`).
- A `*.blogspot.com` address can't be redirected to Vercel by Blogger. Keep the Blogger blog online for a while, or add a short redirect script to its theme.

## Adding new posts later

Create `content/posts/my-post.json`:

    { "title": "My post", "slug": "my-post", "published": "2026-10-20T09:00:00Z",
      "labels": ["Artificial Intelligence"], "image": "", "summary": "One-line summary", "html": "<p>Body here</p>" }

then commit and push. Vercel rebuilds automatically.

## Files

- `src/index.html`: reading-room home page (video scenes, puppy, audio-only player with playlist upload, bookshelf)
- `src/assets/dog.webp`: the puppy
- `export.mjs`: Blogger -> `content/`
- `build.mjs`: `content/` + `src/` -> `public/`
- `vercel.json`: build settings, old-URL redirects, caching
