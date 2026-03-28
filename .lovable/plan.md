

## Update Terms Checkbox Wording

### Rationale
Your logic is correct. The Terms of Use already state that using the platform constitutes agreement. The checkbox should confirm the user has *read* them, not redundantly ask for agreement. This is cleaner and more user-friendly.

### Change
In all 9 files, replace:
```
I agree to the Terms of Use
```
with:
```
I have read the Terms of Use
```

### Files (9)
1. `src/components/drip/CreateDrip.tsx` (line 422)
2. `src/components/dao/CreateDao.tsx` (line 625)
3. `src/components/dao/TreasuryDeposit.tsx` (line 244)
4. `src/components/farm/CreateFarm.tsx` (line 693)
5. `src/components/bannerads/BulkRentDialog.tsx` (line 124)
6. `src/components/bannerads/RentSlotDialog.tsx` (line 102)
7. `src/components/drops/CartDrawer.tsx` (line 92)
8. `src/components/locker/CreateLock.tsx` (line 271)
9. `src/components/locker/CreateLiquidityLock.tsx` (line 293)

Each is a single-line text change: `I agree to the` → `I have read the`

