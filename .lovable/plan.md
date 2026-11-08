# Run the CHEESECrypt Tor helper on Windows

Folder: `C:\Users\User\Desktop\crypt-tor-proxy`

Use the updated **v1.1** helper. The earlier download had a Tor connection bug; these steps replace it on your PC.

## Replace the old helper first

1. In the PowerShell window running the helper, press **Ctrl+C**.
2. Refresh CHEESEHub, go to **CHEESECrypt → Menu → Privacy**, open the Tor guide and download the helper again.
3. In PowerShell, run these commands. The copy replaces the old file; use the new download's actual filename if your browser added `(1)`.

```powershell
Set-Location "C:\Users\User\Desktop\crypt-tor-proxy"
Copy-Item "$env:USERPROFILE\Downloads\cheesecrypt-tor-proxy.mjs" ".\cheesecrypt-tor-proxy.mjs" -Force
node .\cheesecrypt-tor-proxy.mjs
```

4. Confirm the window says **helper v1.1**. Keep Tor Browser connected and this window open.
5. In a second PowerShell window, check the actual history request:

```powershell
curl.exe --max-time 40 "http://127.0.0.1:8088/v2/history/get_actions?account=crypt.cheese&limit=1"
```

6. A JSON response containing an **actions array** means the request worked (it can be empty). An `error` response explains what failed.
7. Refresh CHEESEHub so it uses the updated connection test. Enter **http://127.0.0.1:8088**, tick **Use only this server** to prevent direct history fallback, and press **Test & connect server**. Allow local-network access if your browser asks. Wait up to 40 seconds.
8. If it fails, provide the message from the app and the result of the command above; do not send key files or wallet secrets.

## Step 1 - Check Node.js is installed

1. Press the Windows key, type `PowerShell` and open it.
2. Run:
   ```
   node -v
   ```
3. If it shows `v18` or higher (for example `v20.11.0`), go to Step 2.
4. If it shows an error or a version below 18, install the LTS version from https://nodejs.org. Then close PowerShell, open it again and repeat this step.

## Step 2 - Start Tor

1. Install Tor Browser from https://www.torproject.org/download/ if you don't have it.
2. Open Tor Browser and click **Connect**.
3. Wait until the Tor start page loads. You can minimise the window, but keep it open the whole time you use the helper.

## Step 3 - Put the helper file in your folder

1. In CHEESEHub, go to CHEESECrypt, then Menu, then Privacy.
2. Open **"How to use Tor with CHEESECrypt"** and click **Download the helper**.
3. Move `cheesecrypt-tor-proxy.mjs` from your Downloads folder into `C:\Users\User\Desktop\crypt-tor-proxy`.

Or move it with this command in PowerShell:
```
Move-Item "$env:USERPROFILE\Downloads\cheesecrypt-tor-proxy.mjs" "C:\Users\User\Desktop\crypt-tor-proxy\"
```

If you already made `proxy.mjs`, `package.json` or a `node_modules` folder from my earlier instructions, delete them. That earlier script had bugs, and the new helper needs no installs.

## Step 4 - Run the helper

In PowerShell, run:
```
cd "C:\Users\User\Desktop\crypt-tor-proxy"
node cheesecrypt-tor-proxy.mjs
```

You should see:
```text
CHEESECrypt Tor helper v1.1 is running
   Address for CHEESECrypt: http://localhost:8088
   Tor port 9150 is open (connection verified on first request)
   Leave this window open. Press Ctrl+C to stop.
```

Keep this PowerShell window open while you chat.

## Step 5 - Check it works (optional)

Open a **second** PowerShell window and run:
```
curl.exe --max-time 40 "http://127.0.0.1:8088/v2/history/get_actions?account=crypt.cheese&limit=1"
```

A JSON response containing an `actions` array means it works. Requests can take up to 40 seconds while slow servers are skipped. A port-open message alone does not prove that requests work through Tor.

## Step 6 - Connect CHEESECrypt

1. In CHEESECrypt, go to Menu, then Privacy, then **Your own history server**.
2. Enter `http://127.0.0.1:8088`.
3. Optional: tick **Use only this server** if you never want CHEESECrypt to contact public servers directly. Without the helper running, history checks will then stop.
4. Click **Test & connect server**. You should see "Saved. CHEESECrypt now asks this server first."

## Every time you use it

1. Open Tor Browser and click Connect.
2. Open PowerShell and run:
   ```
   cd "C:\Users\User\Desktop\crypt-tor-proxy"
   node cheesecrypt-tor-proxy.mjs
   ```
3. When you're done, press `Ctrl+C` in that window to stop it.

## If something goes wrong

| Message | Fix |
|---|---|
| `node is not recognized` | Install Node.js (Step 1), then reopen PowerShell. |
| `Tor not found yet` | Open Tor Browser and click Connect. |
| `Port 8088 is already in use` | The helper is already running in another window. Close that window or use it. |
| `Cannot find module ...cheesecrypt-tor-proxy.mjs` | The file isn't in the folder. Run `dir` to check, then redo Step 3. |
| "Every public history server failed through Tor" | Wait a minute and try again. Tor will pick a new route. |
| Test & connect fails in CHEESECrypt | Make sure the PowerShell window is still open, then run the Step 5 check. |
| Browser local-network prompt | Allow access for CHEESEHub if you want it to reach your local helper. |

## What this does and doesn't protect

- Public WAX servers see a Tor address instead of your home IP when CHEESECrypt checks for messages.
- Sending messages still goes through Anchor and your wallet, not Tor.
- Other CHEESEHub requests do not automatically use this helper; it is not complete anonymity. Your provider may see that you connect to Tor; HTTPS protects the history request from the Tor exit, but the history server sees the requested blockchain data.
- Tor client use is permitted in many jurisdictions, but restrictions and circumstances vary; this is not legal advice or a guarantee of zero liability.
