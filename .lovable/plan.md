

## Enhance RAM check warning in CreateDrop

The current RAM shortage warning is minimal ("Insufficient RAM / Use Manage RAM to deposit more"). The source repo shows detailed shortage info and a loading state. Two changes needed:

### 1. Add RAM loading indicator (lines 310-311)
After the Max Claimable input, add the "Checking RAM balance..." spinner that shows while `loadingRamBalance` is true and a collection is selected.

### 2. Expand the RAM shortage warning (lines 311-321)
Replace the brief warning with the full source version showing:
- Available NFTs vs requested amount
- Byte shortfall with estimated WAX cost
- Direct reference to "Manage RAM" at top of page

### File: `src/components/drops/CreateDrop.tsx`

**Add after line 310** (after the input, before the ramShortage block):
```tsx
{formData.dropType === 'premint' && (
  <p className="text-xs text-muted-foreground">Auto-set based on selected NFTs</p>
)}
{formData.dropType === 'mint-on-demand' && loadingRamBalance && formData.collectionName && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <Loader2 className="h-3 w-3 animate-spin" />
    Checking RAM balance...
  </div>
)}
```

**Replace the existing ramShortage block** (lines 311-321) with the detailed version from source:
- Shows `ramShortage.availableNFTs` NFTs worth of RAM vs `formData.maxClaimable`
- Shows byte shortfall and estimated WAX cost
- Highlights "Manage RAM" text as actionable guidance

No other files change.

