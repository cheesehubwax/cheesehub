

## Fix GitHub Actions Node.js 20 Deprecation Warning

The warning is about the action versions (`actions/checkout@v4`, `actions/setup-node@v4`) using Node.js 20 internally. The fix is to bump them to `@v5` which supports Node.js 24.

### Change: `.github/workflows/deploy.yml`
- `actions/checkout@v4` → `actions/checkout@v5`
- `actions/setup-node@v4` → `actions/setup-node@v5`
- `actions/upload-pages-artifact@v3` → `actions/upload-pages-artifact@v4`
- `actions/deploy-pages@v4` → `actions/deploy-pages@v5`

One-file change, no other files affected.

