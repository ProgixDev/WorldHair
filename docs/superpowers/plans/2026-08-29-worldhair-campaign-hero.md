# WorldHair Campaign Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing hero placeholder with the WorldHair product-editorial campaign composition and its generated project assets.

**Architecture:** Keep presentation within `HeroSection.tsx`, loading public image assets through Next.js `Image`. Extend the page-level test to assert the new primary heading and booking CTA so the content contract remains regression-tested.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Jest, React Testing Library.

## Global Constraints

- Use `web/public/images/worldhair-hero-art-v1.png` and `web/public/images/worldhair-stylist-card-v1.png` without new dependencies.
- Preserve a responsive, dark luxury campaign layout.
- Do not change the unrelated SMTP route test.

---

### Task 1: Lock the public hero content contract

**Files:**
- Modify: `web/src/app/(marketing)/page.test.tsx`

**Interfaces:**
- Consumes: `Home` default export.
- Produces: assertions for the `WorldHair` heading and `Trouver votre coiffeur` CTA.

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByRole("heading", { name: "WorldHair" })).toBeInTheDocument();
expect(screen.getByRole("link", { name: "Trouver votre coiffeur" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --cwd web test -- src/app/(marketing)/page.test.tsx --runInBand`

Expected: FAIL because the former headline and CTA are rendered.

- [ ] **Step 3: Implement the minimal hero replacement**

Render the `WorldHair` heading and matching link in `HeroSection`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun --cwd web test -- src/app/(marketing)/page.test.tsx --runInBand`

Expected: PASS.

### Task 2: Build the campaign composition

**Files:**
- Modify: `web/src/components/sections/HeroSection.tsx`

**Interfaces:**
- Consumes: public generated artwork at `/images/worldhair-hero-art-v1.png` and `/images/worldhair-stylist-card-v1.png`.
- Produces: a responsive campaign hero.

- [ ] **Step 1: Layer the full-width campaign artwork**

Use `next/image` with `fill`, `object-cover`, and empty alt text below a dark gradient overlay.

- [ ] **Step 2: Add the large headline and lower-left booking copy**

Use an `h1` with `WorldHair`, then include the French booking message and a `Trouver votre coiffeur` link.

- [ ] **Step 3: Add upper CTA and stylist card**

Use the existing `Button`, an arrow icon, a bordered card, generated portrait, rating and salon metadata.

- [ ] **Step 4: Verify quality gates**

Run: `bun --cwd web typecheck`, `bun --cwd web lint`, and `bun --cwd web test -- src/app/(marketing)/page.test.tsx --runInBand`.

Expected: all hero-specific checks pass; the full suite's known mail timeout remains excluded.
