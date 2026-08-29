# WorldHair Campaign Hero Design

## Goal

Replace the current functional placeholder hero with a premium campaign layout inspired by the supplied beauty-editorial reference while using original WorldHair imagery and content.

## Composition

- A dark, full-width hero establishes the campaign background.
- `WorldHair` is the oversized white headline, layered over the center artwork.
- Short French booking copy and a text CTA sit at the lower left.
- The generated unbranded haircare artwork is centered as a decorative campaign visual.
- A white, framed stylist card with generated portrait sits at the lower right.
- A pill CTA at the upper right links the composition to the coiffeur sign-up path when routes are available; it remains a visual button for now.

## Assets

- `web/public/images/worldhair-hero-art-v1.png`: generated unbranded haircare artwork.
- `web/public/images/worldhair-stylist-card-v1.png`: generated original stylist portrait.

## Constraints

- Keep the assets accessible: decorative campaign art has empty alt text and the stylist portrait has useful alt text.
- Preserve responsive behavior: no clipping of key copy or card on narrow screens.
- Use existing Tailwind and the `Button` primitive; do not add dependencies.
- Scope excludes navigation behavior and the unrelated SMTP test timeout.
