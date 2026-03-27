

## Fix Remove Asset Actions in CHEESEFarm

### Problem
The erase action names in `src/lib/farm.ts` are wrong. The contract uses `removecol`, `removeschema`, `removetemp` — not `erasecolvalue`, `eraseschvalue`, `erasetmpvalue`.

### Changes

**`src/lib/farm.ts`** — Update 3 (or 4) action builders:

| Function | Current action name | Correct action name |
|---|---|---|
| `buildEraseTemplateValuesAction` | `erasetmpvalue` | `removetemp` |
| `buildEraseSchemaValuesAction` | `eraseschvalue` | `removeschema` |
| `buildEraseCollectionValuesAction` | `erasecolvalue` | `removecol` |
| `buildEraseAttributeValuesAction` | `eraseattvalue` | `removeattr` (TBD — user to confirm) |

The data field names may also differ on the contract. The user should verify the parameter names match what the contract expects (e.g., `template_id` vs `temp_id`). If the user can share the ABI or parameter names for these actions, we can fix those too.

### Note
Keep the trash/delete buttons in `ManageStakableAssets.tsx` — they were correct, just the action names were wrong.

### Files changed: 1
- `src/lib/farm.ts`

