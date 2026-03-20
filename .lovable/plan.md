

## Fix: package-lock.json out of sync

The build fails because `npm ci` requires `package-lock.json` to exactly match `package.json`, but several packages have mismatched versions (e.g. `@tanstack/react-virtual`, `@wharfkit/session`, `picomatch`) and others are missing entirely.

### Root cause
Lovable uses `bun` locally (you have `bun.lock` and `bun.lockb`), but the GitHub Actions workflow runs `npm ci` which needs a valid `package-lock.json`. The lockfile has drifted.

### Fix — one change to the workflow

Switch the workflow from `npm` to `bun`, which will use your existing `bun.lock` that is already in sync:

**`.github/workflows/deploy.yml`** — replace the build job steps:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run build
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist
```

This removes the need for `actions/setup-node` and `npm ci` entirely, and uses the `bun.lock` that's already committed and in sync.

No other files need to change.

