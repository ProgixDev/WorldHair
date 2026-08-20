
Do not commit frequently. Only commit when a major milestone or feature has been completed. For example, do not commit just for installing dependencies or single minor tasks.

Always strictly follow the DESIGN.md file for any design tokens, colors, or UI decisions.

## Mobile: sizing for different screens

Don't hardcode sizes tuned against one device width — a layout picked against a single phone sits visibly wrong (too cramped, too sparse, overflowing) on anything narrower, wider, or tablet-sized.

- Derive sizes from the live viewport rather than a fixed constant. Read window dimensions reactively (a hook), never once at module load — a value read only at import time survives neither a rotation nor a fold.
- Scale within sane bounds, not linearly — a straight ratio shrinks content to unreadable on a small phone and blows it up absurdly on a tablet.
- A bigger screen should earn more content (more columns, more items visible), not just bigger versions of the same content.
- Never scale font size manually — the OS already scales text per the user's system font-size setting, so scaling it again double-applies and breaks accessibility. Let containers adapt to text (e.g. min-height, not fixed height) instead.

## Mobile: environment gotchas

- **Use `npm run typecheck`, never `npx tsc`** — `npx tsc` resolves an unrelated decoy package in this repo (confirmed: it prints "This is not the tsc command you are looking for" instead of type-checking).
