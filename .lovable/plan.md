

## Match FarmCard styling to DaoCard

**Changes to `src/components/farm/FarmCard.tsx`:**

1. **Card border**: Change from `border-border/50 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer group flex flex-col` to `border-primary/30 shadow-lg transition-all cursor-pointer group flex flex-col` (permanent orange border like DaoCard)

2. **View Details button**: Change from `variant="outline"` with hover classes to a filled primary button matching DaoCard:
   - `className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"` 
   - Remove the `group-hover:border-primary/50 group-hover:text-primary` classes

3. **Keep all content identical** -- just the card border and button styling change to match DaoCard's color scheme.

