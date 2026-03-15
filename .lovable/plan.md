

## Add Help Dialogs, Disclaimer & Terms Pages

Four changes needed to match the source repository exactly.

### 1. Create `src/pages/Disclaimer.tsx`
Full legal disclaimer page with 13 sections (General Clause, Nature of CHEESE, Immutable Token Contract, Open-Source Software, Financial Services, No Dealing/Advising, Platform Features & dApps with subsections 7.1-7.9, Liquidity Provision, Tax Obligations, International Users, Risk Warnings, Liability, Not Professional Advice). Wrapped in `<Layout>`, container `max-w-3xl`, styled exactly as the source with `text-cheese` headings, `text-muted-foreground` body text, and `code` elements for contract names.

### 2. Create `src/pages/Terms.tsx`
Terms of Use page with 14 sections (Acceptance, Platform Description, Immutable Token Contract, Open-Source Software, Eligibility, User Responsibilities as bullet list, Intellectual Property, Prohibited Use, Third-Party Services, Merchandise, No Warranties, Limitation of Liability, Modifications, Governing Law). Same styling pattern as Disclaimer.

### 3. Update `src/App.tsx`
Add routes `/disclaimer` and `/terms` above the catch-all route. Import both new pages.

### 4. Update `src/components/Footer.tsx`
Add Disclaimer and Terms links between the "Advertise with CHEESEHub" link and the copyright line, matching the source repo's footer pattern. Links will be `<Link to="/disclaimer">` and `<Link to="/terms">`.

### 5. Update `src/components/dao/CreateDao.tsx` -- Help Dialog
Replace the current "ask me for help" external link with a `Dialog` containing a `ScrollArea` with an `Accordion` of FAQ items matching the source exactly:
- Paying with CHEESE Tokens
- DAO Name Format
- DAO Types Explained (Type 4 & 5 details)
- Configuration Settings (Threshold, Minimum Votes, Voting Duration, Proposer Types, Proposal Cost, Treasury & Deposits)
- IPFS Hash (Avatar & Cover Image)
- Modifying Settings Later
- Why does Anchor show a "Dangerous Transaction" warning?

The trigger is a "click me for help" text link styled in primary color.

### 6. Update `src/components/farm/CreateFarm.tsx` -- Help Dialog
Replace the current inline Accordion in the confirmation screen with a proper `Dialog` triggered by "click me for help" in the form header. The dialog contains the FAQ_ITEMS from the source:
- Can I pay with CHEESE tokens?
- What is the correct format for my farm name?
- How much does it cost to create a farm?
- What are the different farm types?
- How do I add stakable assets after creation?
- Is there a limit to how many NFTs can be staked?
- Can I have multiple reward tokens?
- How often are rewards paid out?
- Are staked NFTs safe?
- What are the IPFS hash fields for?
- Why does Anchor show a 'Dangerous Transaction' warning?

Also update the YouTube embed URL from the rickroll placeholder to the correct one: `https://www.youtube.com/embed/PIV_ojHzkS8`.

### Technical Details
- Uses existing UI components: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`, `ScrollArea`, `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`, `Badge`
- Both help dialogs use `ScrollArea` with a max height for the accordion content
- Disclaimer and Terms pages follow the same `<Layout>` wrapper pattern as all other pages

