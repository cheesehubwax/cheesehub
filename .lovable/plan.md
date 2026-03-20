

## Fix: `actions/deploy-pages@v5` does not exist

The `deploy-pages` action only goes up to `v4`. We bumped it too far. Change it back to `@v4`.

### Change: `.github/workflows/deploy.yml`
- `actions/deploy-pages@v5` → `actions/deploy-pages@v4`

One-line change, nothing else affected.

