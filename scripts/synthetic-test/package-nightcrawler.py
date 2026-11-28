"""Rebuild the app's static Nightcrawler source download; never include private configs."""
from pathlib import Path
import json
import zipfile

source = Path(__file__).resolve().parent
destination = source.parent.parent / 'public' / 'downloads' / 'nightcrawler'
destination.mkdir(parents=True, exist_ok=True)
names = ['night.ts', 'policy.ts', 'runtime.ts', 'nightState.ts', 'bun.lock', 'night-config.example.json']
for name in names:
    (destination / name).write_bytes((source / name).read_bytes())
package = json.loads((source / 'package.json').read_text())
package['scripts'] = {'start': 'bun run night.ts night-config.json', 'check': 'bun run night.ts night-config.json --dry-run'}
(destination / 'package.json').write_text(json.dumps(package, indent=2) + '\n')
# Keep the runner's safety/privacy documentation in the source download.
(destination / 'README.md').write_text('''# CHEESECrypt Nightcrawler

Place this folder inside your existing cheesecrypt folder, and save your private
night-config.json here. Install Bun from https://bun.sh and run `bun install` once.
Keep Tor Browser and the local Tor helper running; keep your computer awake.

Check: `bun run check`
Start: `bun run start`
Stop: Ctrl+C in the running terminal. The website cannot switch a local process off.
The new setup assistant uses a dedicated nightcrawler permission; existing isolated
cheesecrypt permissions remain supported. Neither should have token transfer links.

''' + (source / 'README.md').read_text().split('## Nightcrawler (separate, optional)\n', 1)[1])
names += ['package.json', 'README.md']
(destination / 'manifest.json').write_text(json.dumps(names))
with zipfile.ZipFile(destination.parent / 'cheesecrypt-nightcrawler.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in names:
        archive.write(destination / name, 'nightcrawler/' + name)
print('Nightcrawler source bundle rebuilt; no user keys, state or daytime entry point included.')