# Onboarding & auth — design

Date: 2026-08-18 · Updated 2026-08-20 (built, full section)
Scope: TODO.md → Frontend → "Onboarding & auth", all seven items.

## Constraints

- Frontend only — no backend exists (stack undecided in TODO.md). Every auth
  call is mocked behind `services/auth.ts`, the single file the real API
  replaces later.
- `expo-location`, `expo-auth-session`, `expo-apple-authentication` are NOT
  installed. Geolocation and OAuth are stubbed and flagged in code.
- `expo-image-picker` and `expo-document-picker` ARE installed (justificatifs).
  Both are native modules: `android/` is prebuilt, so a rebuild is required
  before the pickers work on device.
- `.agents/AGENTS.md` governs sizing and screen structure, `DESIGN.md` colors
  and type.

## Flow

    app/index.tsx (splash) → hydrate session + onboarding flag
        nextRouteForSession(session, onboardingSeen)   [features/auth/routing.ts]
          !onboardingSeen ................ /onboarding
          no session ..................... /auth/sign-in
          !emailVerified ................. /auth/verify-email
          coiffeur, dossier en revue ..... /auth/pending
          coiffeur, dossier à remplir .... /auth/pro/identity
          particulier sans profil ........ /auth/profile-setup
          sinon .......................... /home

`nextRouteForSession` is pure, so the gate is decided in one place and can be
reasoned about without a navigator.

## Onboarding

Three slides over the art in `assets/images/OnBoarding`:

| # | Art | Heading | CTA |
|---|-----|---------|-----|
| 1 | OnBoarding1 (dark portrait, full bleed) | Votre prochain look commence ici. | Commencer |
| 2 | OnBoarding2 (cream collage, top panel) | Une coiffure qui vous ressemble. | Trouver mon style |
| 3 | OnBoarding3 (salon, top panel) | Le bon salon, au bon moment. | Activer ma position + ghost "Choisir une ville" |

Slide 1 carries the wordmark (`WorldHair` / `LA BEAUTÉ, PARTOUT.`) over the art.
Every slide opens its copy block with a warm editorial rule. Paged horizontal
list; swipe and CTA both advance. Dots + `n/3` at the bottom. No skip control
(absent from the mockups).

Slide 3's two CTAs both complete onboarding and route to `/auth/sign-in`; they
differ only in the `locationIntent` (`"gps"` | `"manual"`) they persist for the
later particulier home screen. The real permission prompt belongs where the
`TODO` marker sits in `app/onboarding/index.tsx`.

### Palette decision (reversed 2026-08-20)

Earlier decision: onboarding adapts to the app theme. **Now: each slide wears a
fixed palette sampled from its own artwork** (navy `#000f20`, cream `#f2e6d9`,
warm white `#f7f4f1`), matching the mockups exactly. Onboarding is a pre-auth
brand moment; the app theme takes over from the auth screens onward. The art
still dissolves into its surface through a `LinearGradient`, so no hard seam.
Reverting is a change to `palette` in `features/onboarding/slides.ts` alone.

The CTA pill is identical on all three slides — accent `#38b6ff` on brand ink
`#0c2340` (DESIGN.md tokens, and legible on every surface).

## Auth screens

| Route | Content |
|-------|---------|
| `auth/sign-in` | wordmark, serif H1, email + password, `ou` divider, Google (Apple on iOS), link to sign-up |
| `auth/sign-up` | Particulier/Coiffeur segmented control, email, password + strength meter, CGU checkbox |
| `auth/verify-email` | 6-box OTP, resend with 30 s cooldown, "utiliser une autre adresse", demo-code notice |
| `auth/profile-setup` | avatar picker (optional photo), prénom, nom → `/home` |
| `auth/pro/identity` | wizard 1/3 — prénom, nom, téléphone (FR) |
| `auth/pro/salon` | wizard 2/3 — nom du salon, présentation, adresse, CP, ville |
| `auth/pro/documents` | wizard 3/3 — pièce d'identité + diplôme, attestation, envoi |
| `auth/pending` | dossier en revue (timeline + récap) or refusé (motif + reprise) |

"Mot de passe oublié" is deliberately absent — not part of this TODO section.
The coiffeur wizard keeps its answers in `ProApplicationProvider`
(`app/auth/pro/_layout.tsx`), so a back-navigation never loses input.

`auth/pending` carries a dashed "Mode démo" card that simulates the admin
decision, since no back-office exists yet. `home` gained an "ONBOARDING & AUTH"
section linking every screen plus a demo reset.

## Modules

| File | Responsibility |
|------|----------------|
| `constants/typography.ts` | Playfair display + Roboto presets (fontSize never scaled) |
| `constants/spacing.ts` | 4pt scale, radii, touch-target minimum |
| `constants/responsive.ts` | pure size helpers + `useResponsive()` on live dimensions |
| `constants/themes.ts` | adds `primary.on`, `accent.warm`, `border`, `danger`, `success` |
| `utils/validation.ts` | pure email / password / name / FR phone / CP validators |
| `services/preferences.ts` | AsyncStorage: onboarding seen, location intent |
| `services/auth.ts` | mock auth with latency + typed `AuthError`; the API seam |
| `contexts/AuthContext.tsx` | session state, hydration flag, every auth action |
| `features/auth/routing.ts` | route table + pure `nextRouteForSession` |
| `features/onboarding/slides.ts` | slide copy, art and palettes |
| `features/pro/ProApplicationContext.tsx` | coiffeur wizard draft |
| `components/ui/*` | Screen, Button, TextField, SocialButton, SegmentedControl, Checkbox, AuthHeader, OtpInput, AvatarPicker, UploadSlot |
| `components/onboarding/*` | OnboardingSlide, Pagination |

## Screen contract

- Safe areas are owned by `app/_layout.tsx`. Immersive routes (`/`,
  `/onboarding`) get no insets from it and handle their own; every other route
  gets the top inset there and the bottom inset from the root view. No screen
  re-applies `SafeAreaView`.
- Sizes come from `useResponsive()`; `fontSize` is never scaled; text
  containers use `minHeight`. Spacing comes from the fixed `spacing` scale.

## Typography

Playfair Display Regular/Medium/Bold vendored as static instances in
`assets/fonts/PlayfairDisplay` (not the variable `[wght]` file, which Android
resolves unreliably). Loaded via `useFonts`; the native splash is held until
the fonts resolve so headings never swap typeface mid-view.

## Verification

`npm run typecheck` and `bun expo lint` both clean (never `npx tsc` — it
resolves a decoy package in this repo), plus `bun expo export --platform
android` as a bundle smoke test. No test runner is configured, so pure logic
lives in `utils/validation.ts` and `features/auth/routing.ts` ready to be
tested once one is.
