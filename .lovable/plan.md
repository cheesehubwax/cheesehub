

## Hide Cart Icon Except on CHEESEDrop Page

### What Changes
The shopping cart icon button in the header will only be visible when the user is on the `/drops` route (or any `/drops/*` sub-route). On all other pages it will be hidden.

### File: `src/components/Header.tsx`

Wrap the cart `Button` in a conditional check using the existing `location.pathname`:

```tsx
{location.pathname.startsWith("/drops") && (
  <Button
    variant="ghost"
    size="icon"
    className="relative hover:bg-primary/10 h-8 w-8 sm:h-9 sm:w-9"
    onClick={() => setIsOpen(true)}
  >
    <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
    {totalItems > 0 && (
      <span className="absolute -top-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-primary text-[10px] sm:text-xs font-bold text-primary-foreground">
        {totalItems}
      </span>
    )}
  </Button>
)}
```

### Files Changed
- `src/components/Header.tsx` — one conditional wrapper added around the cart button (~line 108–120)

