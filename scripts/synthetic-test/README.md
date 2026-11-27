# CHEESECrypt synthetic test

Local test runner simulating client message traffic through `crypt.cheese`.
Used to verify contract fee routing, sponsor budget depletion, and node
response times under periodic and burst loads.

## Setup

1. Copy `config.example.json` to `config.json` and fill in accounts and keys
   (git-ignored; keep it private).
2. Run the Tor helper (`public/downloads/cheesecrypt-tor-proxy-v1.6.mjs`).
3. Run:

   ```
   bun install
   bun run run.ts config.json --dry-run   # builds and signs locally, broadcasts nothing
   bun run run.ts config.json
   ```

Optional `night` settings schedule a few random sends between your configured accounts inside a local time window; `--dry-run` prints a sample night plan. Progress is kept in a git-ignored `*.night.json` file.
