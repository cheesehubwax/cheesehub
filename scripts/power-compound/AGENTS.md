# Runner rules

- Keep this runner isolated with locked dependencies and an opt-in serialized workflow so unattended signing never alters the frontend or runs before explicit activation.
- Use current chain state for claim timing and a dedicated action-linked permission; verify key isolation before signing because an active/owner key would exceed intended authority.
- Keep amount/timing policies in pure tested functions, use integer WAX units, refresh balances after irreversible claims and skip pending refunds because stale balances/refund reuse can misallocate stake.
- Pin writes to the preflight endpoint and never blindly retry an ambiguous submission; check executed transaction IDs and irreversibility before further actions to prevent duplicate or rolled-back maintenance.
- Explain that action links cannot limit delegatebw arguments; script-only reserve/receiver restrictions are not on-chain spending limits.