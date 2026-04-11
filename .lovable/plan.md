

## Fix GitHub Pages SPA Deep-Link Routing

### Problem
The `404.html` and `index.html` use **mismatched** SPA redirect strategies:
- `404.html` converts `/cheesehub/bannerads` → `/cheesehub/?/bannerads` via URL replacement
- `index.html` reads `sessionStorage.redirect` — but `404.html` never writes to `sessionStorage`

Result: the `?/bannerads` query string stays in the URL and React Router never sees `/bannerads` as the actual path, so routing breaks.

### Fix
Align both files to use the same redirect mechanism. The standard approach (used by [spa-github-pages](https://github.com/rafgraph/spa-github-pages)):

**1. `public/404.html`** — store the real path in `sessionStorage` before redirecting:
```js
sessionStorage.redirect = l.pathname + l.search + l.hash;
l.replace(
  l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
  l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/')
);
```

**2. `index.html`** — the existing handler already reads `sessionStorage.redirect` and calls `history.replaceState`. No changes needed.

This way, visiting `/cheesehub/bannerads` → 404.html saves the path → redirects to `/cheesehub/` → index.html restores `/cheesehub/bannerads` via replaceState → React Router matches the route.

### Files changed: 1
- `public/404.html`

