## Goal

Reset the broken GitHub connection by archiving the old `cheesehub` repo and letting Lovable create a fresh repo with the same name, so the existing GitHub Pages URL (`https://cheesehubwax.github.io/cheesehub/`) keeps working with zero changes for users.

## Why the name must stay `cheesehub`

The app's deploy config hard-codes the repo name in two places:

- `vite.config.ts` → `base: mode === "production" ? "/cheesehub/" : "/"`
- `public/404.html` → `pathSegmentsToKeep = 1` (keeps the `/cheesehub/` prefix for SPA deep-link refresh)

`BrowserRouter` reads `import.meta.env.BASE_URL`, so it follows `base` automatically. As long as the new repo is named exactly `cheesehub`, none of this needs to change.

## Plan

### 1. Back up
- On GitHub, old repo → `Code → Download ZIP` as a safety net.
- Confirm the current Lovable preview reflects the latest state you want to keep (it does — Lovable is the source of truth, GitHub is just out of sync).

### 2. Rename the old repo on GitHub
- Old repo → Settings → Repository name → rename `cheesehub` → `cheesehub-classic` (or `cheesehub-archive`).
- GitHub keeps redirects for old git URLs, so no external link breaks.
- Its Pages URL becomes `https://cheesehubwax.github.io/cheesehub-classic/` — no one is using that, ignore it.

### 3. Disconnect GitHub in Lovable
- Lovable → workspace Settings → Integrations → disconnect GitHub.
- Project Settings → GitHub → disconnect if it appears there too.

### 4. Reconnect and create the new repo
- `+` menu (bottom-left of chat) → GitHub → Connect project.
- Authorize Lovable on the `cheesehubwax` account if prompted.
- Create a new repo named exactly **`cheesehub`** under `cheesehubwax`.
- Wait for Lovable's initial push to complete.

### 5. Enable GitHub Pages on the new repo
- New repo → Settings → Pages → Source = **GitHub Actions**.
- Actions tab → confirm `Deploy to GitHub Pages` (from `.github/workflows/deploy.yml`, which travels with the code) runs green.
- First successful deploy republishes `https://cheesehubwax.github.io/cheesehub/`.

### 6. Verify
- Load `https://cheesehubwax.github.io/cheesehub/` — homepage renders.
- Hit a deep link like `/cheesehub/dao` and hard-refresh — SPA fallback works (404.html → index.html).
- Make a 1-character edit in Lovable, confirm a commit lands in the new repo and the site updates after the workflow finishes.

## Downtime expectation

The Pages URL keeps serving from the old repo until step 5 completes, but step 2 (rename) changes the old repo's slug, which means `cheesehubwax.github.io/cheesehub/` will 404 between step 2 and the first successful deploy on the new repo in step 5. Expect roughly **5–15 minutes of downtime** on the public site depending on how fast the new repo's first Action runs. To minimize it, do steps 2 → 4 → 5 back-to-back without pauses.

## Rollback

If anything goes wrong, rename `cheesehub-classic` back to `cheesehub` on GitHub. Its previous Pages deployment is still in place and will resume serving immediately.

## What does NOT change

- Lovable preview URL
- Lovable Cloud database, edge functions, secrets
- Project code (it's already in Lovable; GitHub just becomes a fresh mirror)
- Any in-app branding, config, or contract integrations