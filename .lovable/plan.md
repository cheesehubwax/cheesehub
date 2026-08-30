# Plan: Publish CHEESERam price history tracking to GitHub

Goal: get the historical RAM price tracking system (built this session) live on your GitHub Pages site, and start the automated recorder that samples prices every 4 hours. Written for someone doing this for the first time.

## What is being shipped

1. `scripts/ram-price-history/` — a small recorder script that reads the live RAM price (WAX/KB, CHEESE/KB, USD/KB) and appends it to a history file.
2. `.github/workflows/ram-price-history.yml` — a GitHub Actions "robot" that runs the recorder automatically every 4 hours.
3. `src/hooks/useRamPriceHistory.ts` + updated `src/components/ram/RamPricePanel.tsx` — the CHEESERam page now has LIVE / 24H / 7D / 30D / ALL tabs that read the recorded history.

## Key concept (read once, makes everything below make sense)

Your site deploys from the `main` branch. If the robot saved its data on `main`, every 4-hour sample would trigger a full site rebuild — wasteful and slow. So instead the robot saves data to a **separate branch** called `ram-price-data`. Think of branches as parallel folders of your project: `main` = the website, `ram-price-data` = just a data file (`data/ram-price-history.json`). The website reads the data file directly from GitHub's "raw" file URL, so the site code and the data never interfere with each other.

## Step-by-step

### Step 1 — Push the code from Lovable to GitHub
You don't need a terminal. In the Lovable editor:
1. Click the **GitHub icon** (top right) to open the GitHub panel.
2. Click **Sync / Push** so all the new files above land on your repo's `main` branch.
3. Wait ~1–2 minutes for the existing GitHub Pages deploy workflow to build and publish the site.

### Step 2 — Turn on the recorder robot (first run)
GitHub only runs scheduled workflows after they exist on `main` — which Step 1 does. To avoid waiting up to 4 hours for the first automatic run, trigger it by hand once:
1. Open your repo on github.com.
2. Click the **Actions** tab (top menu).
3. In the left sidebar, click **RAM Price History**.
4. Click the **Run workflow** dropdown (right side), keep branch = `main`, press the green **Run workflow** button.
5. Refresh after ~30 seconds — you should see a green checkmark.

What that first run does behind the scenes:
- Creates the brand-new `ram-price-data` branch automatically (the workflow handles this — nothing for you to do).
- Writes the first price record into `data/ram-price-history.json` on that branch.

### Step 3 — Verify it worked
1. In your repo, click the branch dropdown (says `main`, top-left of the file list) — confirm a branch named `ram-price-data` now exists.
2. Switch to it and open `data/ram-price-history.json` — you should see a JSON array with one record containing `t`, `waxPerKb`, `cheesePerKb`, `waxPerCheese`, `usdPerKb`.
3. Visit the live site's CHEESERam page → price panel → click the **ALL** tab. With only one sample it will look like a dot/flat blip — that's correct. After a day you'll have ~6 points; after a week the 7D tab becomes a real chart.

### Step 4 — Let it run
Nothing more to do. Every 4 hours the robot appends one record (~6 per day). The file is capped at roughly 2 years of history so it never grows unwieldy. The site's 24H/7D/30D/ALL tabs fill in automatically.

## If something goes wrong

- **Actions tab shows a red X on the run:** click it → click the failed job → read the red log lines. Most common cause: the `GITHUB_TOKEN` needs write permission. Fix: repo **Settings → Actions → General → Workflow permissions → "Read and write permissions" → Save**, then re-run the workflow.
- **ALL tab says "No historical samples yet":** the data branch doesn't exist yet (Step 2 not done) or the fetch URL is wrong. The hook defaults to `https://raw.githubusercontent.com/cheesehubwax/cheesehub/ram-price-data/data/ram-price-history.json` — confirm that matches your repo name; if not, set `VITE_RAM_HISTORY_URL` in the repo's environment/config.
- **Scheduled runs seem late:** normal. GitHub cron can drift 5–30 minutes at busy times; the timestamps come from the script, not the schedule, so the chart stays accurate.

## Technical details (for reference)

- No new secrets or paid services required — uses only the built-in `GITHUB_TOKEN` and public APIs (WAX RPC endpoints + Alcor API).
- The workflow uses `actions/checkout` + `bun` to run `scripts/ram-price-history/sample.ts`, then commits only if the data file changed.
- The frontend hook caches history for 15 minutes and downsamples long ranges so charts stay fast.
