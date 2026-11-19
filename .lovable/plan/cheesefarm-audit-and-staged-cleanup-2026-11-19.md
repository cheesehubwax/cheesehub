# CHEESEFarm audit and staged cleanup

## What the audit found
- CHEESEFarm is about 8,100 lines. Three files carry most of it: the staking screen (1,264 lines), the farm data file (1,358 lines) and the Create Farm form (701 lines).
- Only Claim All has tests. Reward calculations, stake reads and the multi-step create/stake transactions have no tests.
- The staking screen uses a missing `/placeholder.svg` image (the same endless-404 problem we fixed in CHEESEDrip) and a single hardcoded Pinata image link. It skips the shared bundled→AtomicHub→IPFS image fallback.
- The farm data file reads templates from one hardcoded AtomicAssets address. That skips the HerdCheck endpoint order rule.
- The Alcor LP farm file (1,188 lines) belongs to CHEESEWallet's farm manager, not CHEESEFarm. It stays out of this audit and goes into the CHEESEWallet audit.

## Stages (each one ships separately; tests must pass before the next stage starts)

**Stage 1 – Lock the maths (no behaviour change)**
Add golden tests for effective balance, reward-per-period values, pending rewards, splitting value lists into chunks, farm-name validation and every transaction builder (exact action names, permissions, data). This is the safety net for everything after it.

**Stage 2 – Fix broken images and the hardcoded link**
Replace the missing placeholder with the shared token logo. Move the staking grid's images onto the shared NFT image fallback. Route the template read through the normal endpoint resolver, falling back across sources.

**Stage 3 – Split the farm data file**
Split it into: constants and types, transaction builders, chain reads (farms, stakes, stakable config, pending rewards), and global staked detection. Keep the original file as a re-export so no screen changes.

**Stage 4 – Break up the staking screen**
Pull the NFT card, virtual grid, media helpers, stake/unstake bar and rewards panel into their own files. Keep state in one staking hook, so the sections only display data.

**Stage 5 – Break up Create Farm and Manage Stakable Assets**
Move the FAQ, the confirmation step, the fee/payment choice and the farm-creation transaction steps into separate parts. Test the full create transaction sequence.

**Stage 6 – Render speed and dead code**
Memoise the stakers table rows and the farm cards. Remove unused exports and leftover files. Update the farm AGENTS.md with the new structure.

## Out of scope
No changes to the farm contract or to fees, wording or layout. The Alcor LP farms are left for the CHEESEWallet audit.
