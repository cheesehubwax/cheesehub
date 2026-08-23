# Make the admin dashboard reachable on the live site

## What is actually happening

The admin page is not missing from the live build — it is just unlinked and undiscoverable.

- `/admin` and `/admin/guide` are registered routes in `src/App.tsx`, so they ship in every build including GitHub Pages.
- Deep links do work: `https://cheesehubwax.github.io/cheesehub/admin` returns GitHub's 404 status, but `public/404.html` catches it, stores the path in `sessionStorage`, redirects to the base, and `index.html` restores the path with `history.replaceState`. Verified against the live site: the 404 response body is the SPA redirect shim, and the base URL returns 200.
- A search of `src/components/Header.tsx` and `src/components/Footer.tsx` found no reference to `admin` anywhere, so there is no link to it in any navigation.

So nothing is broken. What is missing is an entry point, and a way to know the URL without being told.

## Is exposing it a security risk?

Not materially, for this app, provided the change stays presentational.

- Everything on the dashboard is public on-chain data already: `cheeseburner`, `cheesefeefee`, `cheesebannad`, and `cheesepowerz` config/stats tables, Alcor pool prices, and drop purchase history. Anyone can read all of it from any WAX explorer.
- The one action surface, `AddBannerSlotsCard`, still requires a signed transaction from an account the `cheesebannad` contract accepts. The contract is the real gate, and it does not care whether a link exists in the header.
- The `useAdminAccess` check (`fetchIsAdmin` against `cheesebannad::admins`) is a **UI convenience gate, not a security boundary**. It runs in the browser, so anyone can bypass it by editing local state and see the same public data. That is already true today, linked or not — the whole bundle is public JavaScript.

The rule to keep: never put a secret, a private key, or an unauthenticated write path behind this gate. As long as authority lives in the smart contracts, the link is safe.

## The change

Add a discreet admin entry point that only renders when the connected wallet is a whitelisted admin:

1. In `src/components/Header.tsx`, render an "Admin" nav item only when `useAdminAccess()` returns `isWhitelisted`. Non-admins and disconnected visitors see nothing new. Use the existing `NavLink` styling and the same icon language as the rest of the header, so it does not stand out as a bolt-on.
2. Mirror it in `src/components/Footer.tsx` under the same condition, so it is reachable from the bottom of any page.
3. Leave the route, the access gate, and `Admin.tsx` itself untouched.

Because the gate is conditional on an on-chain lookup, the link is invisible to everyone except accounts in `cheesebannad::admins` — which is the right level of obscurity here, not a substitute for the contract-level checks that already exist.

## Right now, before any deploy

You can already reach it. Go to `https://cheesehubwax.github.io/cheesehub/admin` and connect the wallet that is listed in `cheesebannad::admins`. If it shows "Not Authorized", the connected account is not in that table — the fix is adding it on-chain, not in code.

## Technical notes

- `src/components/Header.tsx` — import `useAdminAccess`, conditionally render the nav item; include it in the mobile hamburger list too, guarded by the same flag.
- `src/components/Footer.tsx` — same conditional link.
- `useAdminAccess` already caches with a 5-minute `staleTime` and only runs when connected, so adding two consumers costs no extra RPC traffic.
- No routing, `vite.config.ts`, or `public/404.html` changes are needed — GitHub Pages deep linking is already working.
