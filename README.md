# Parthik Hub

A self-updating content hub: drop HTML pages, PDFs, or images into a folder,
push to GitHub, and they show up in the sidebar automatically — no token to
paste in, no manifest file to edit, no code to touch.

## How the "automatic" part works

A plain static site cannot read its own server folder by itself — there's
no API for "list files in this directory" on Netlify (or most static
hosts). Instead, this hub asks **GitHub's free public API** directly:
"what files exist in this repo?" That works without any login *because the
repo is public* — GitHub serves the full file tree to anyone for public
repos, no token required.

So the flow is:

1. You push files into `/websites/`, `/pdf/`, or `/images/` (any folder
   names, any nesting) on GitHub.
2. Netlify auto-deploys, as it already does.
3. The next time someone opens the hub, `assets/app.js` asks GitHub for the
   repo's full file list, and builds the sidebar tree from that — every
   time, automatically.
4. Each file's real URL is built as `location.origin + path` — so on
   `https://parthik-sites.netlify.app`, a file at `/maths/formula.html` in
   the repo becomes `https://parthik-sites.netlify.app/maths/formula.html`
   automatically, with no hardcoded domain anywhere in the code.

## ⚠️ One-time setup — required before this will work

Open `assets/app.js` and fill in the first three lines:

```js
const GITHUB_OWNER  = 'YOUR-GITHUB-USERNAME';   // e.g. 'parthik'
const GITHUB_REPO   = 'parthik-sites';          // your repo name
const GITHUB_BRANCH = 'main';                   // 'main' or 'master'
```

That's the only thing you ever need to touch. No tokens, no `.env` files,
nothing secret — these three values are not sensitive (anyone can already
see them by visiting your public repo).

> The repo **must stay public** for this to keep working without a token.
> If you ever make it private, GitHub's API will return 404/403 for
> everyone, including your own hub.

## Adding content from here on

```
git add websites/new-page.html
git commit -m "add new page"
git push
```

Wait for Netlify to finish deploying, then refresh the hub (or tap the
refresh icon in the header) — the new file appears in the sidebar. Nothing
else needs editing.

- **Websites**: any `.html` file inside `/websites/` (or any folder).
  Keep each page's own CSS inline, since pages load in an iframe and don't
  share the hub's stylesheet.
- **PDFs**: any `.pdf` file inside `/pdf/`.
- **Images**: any `.jpg/.jpeg/.png/.gif/.webp/.svg` file inside `/images/`.
- Nested folders work too (e.g. `/websites/burns/`, `/pdf/2026/`) — they
  show up as collapsible sub-folders in the sidebar.

## Focus / reading mode

A round button sits fixed in the bottom-right corner at all times. Click it
to hide the header and sidebar completely — the content area expands to
fill the entire screen, with no leftover empty space. Click again (or press
`Esc`) to bring the header and sidebar back. Works the same way on desktop
and mobile.

## Reusing this for a different topic entirely

1. Update `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` to point at the
   new repo.
2. Change `SITE_TITLE` / `SITE_SUBTITLE` in `assets/app.js`.
3. Optionally swap the accent color in `assets/style.css`
   (`--accent` / `--accent-soft` / `--accent-soft-border` near the top).
4. Delete the demo files in `/websites/` and `/pdf/`, add your own.

Nothing else changes — folder auto-detection, search, sidebar, responsive
drawer, and focus mode all work unchanged.

## Limits worth knowing

- GitHub's API allows about **60 unauthenticated requests per hour per
  visitor IP**. For a personal hub or small audience this is no problem —
  each visitor only needs one request per page load (or per refresh tap).
- Very large repos (thousands of files) can have their tree response
  truncated by GitHub — a console warning will appear if that happens.

## What ships in this demo

3 sample HTML pages and 3 sample PDFs under `/websites/` and `/pdf/`, so you
can see the hub working end-to-end before adding your real content.
