# Onboarding & auth entry — design

Date: 2026-08-18
Scope: TODO.md → Frontend → "Onboarding & auth", items 1 and 2 only
(écran d'accueil / onboarding carousel + inscription-connexion).
Out of scope this pass: email verification, particulier profile setup,
coiffeur signup, ID/diploma upload, pending-validation screen.

## Constraints

- No backend exists (stack undecided in TODO.md). All auth calls are mocked
  behind one service module so the real API replaces one file later.
- `expo-location`, `expo-auth-session`, `expo-apple-authentication` are NOT
  installed. Geolocation and real OAuth are therefore stubbed and flagged.
- `.agents/AGENTS.md` governs screen structure, safe areas, sizing, spacing.
- `DESIGN.md` governs color and type tokens.

## Flow

    src/app/index.tsx (splash)  → hydrate AsyncStorage
        !onboardingSeen         → /onboarding
        seen && !session        → /auth/sign-in
        session                 → /home

## Onboarding

Three slides, art already vendored in `assets/images/OnBoarding`:

| # | Art | Heading | CTA |
|---|-----|---------|-----|
| 1 | OnBoarding1 (dark portrait, full bleed) | Votre prochain look commence ici. | Commencer |
| 2 | OnBoarding2 (cream collage, top panel) | Une coiffure qui vous ressemble. | Trouver mon style |
| 3 | OnBoarding3 (salon, top panel) | Le bon salon, au bon moment. | Activer ma position + ghost "Choisir une ville" |

Slide 1 additionally carries the wordmark (`WorldHair` / `LA BEAUTÉ, PARTOUT.`)
over the art. Slide 3 carries a warm-accent rule under its heading.

Paged horizontal list; swipe and CTA both advance. Dots + `n/3` counter at the
bottom, per mockup. No skip control (absent from the mockups).

Slide 3's two CTAs both complete onboarding and route to `/auth/sign-in`; they
differ only in the `locationIntent` (`"gps"` | `"manual"`) they persist for the
later particulier home screen to consume.

## Theme adaptation

Decision: onboarding adapts to the app theme (user's call, against the
recommendation of fixed per-slide surfaces).

Each slide's surface is `theme.background.dark`. Art is full-bleed at the top
with a `LinearGradient` from transparent to that surface over its lower band,
so the photo dissolves into the page rather than ending on a hard seam.

Known risk: the two cream slides in dark mode still read as a bright panel over
a dark page. Mitigation is the gradient plus a dark-mode veil over the art. If
it looks wrong on device, the fallback is fixed per-slide surface colors — a
one-constant change in `slides.ts`.

## Auth entry

`/auth/sign-in`: wordmark, serif H1, email + password fields, `ou` divider,
Google button (Apple additionally on iOS), footer link to sign-up.

`/auth/sign-up`: Particulier/Coiffeur segmented control (the later coiffeur flow
needs the role), email, password, CGU checkbox, footer link to sign-in.

Both call the mock service and route to `/home` on success. "Mot de passe
oublié" is deliberately omitted — it is not part of this TODO section.

## Modules

| File | Responsibility |
|------|----------------|
| `constants/typography.ts` | Playfair display + Roboto body presets |
| `constants/themes.ts` | adds `accent.warm` token (TODO: "tons chauds accent") |
| `constants/responsive.ts` | adds pure `onboardingArtHeightForSize(w,h)` |
| `utils/validation.ts` | pure email/password/name validators |
| `services/preferences.ts` | AsyncStorage keys: onboarding seen, location intent, session |
| `services/auth.ts` | mock auth with latency + typed `AuthError`; the API seam |
| `contexts/AuthContext.tsx` | session state, hydration flag, sign in/up/out |
| `components/ui/Button.tsx` | primary pill / ghost, M3 state layer |
| `components/ui/TextField.tsx` | label, error, password visibility toggle |
| `components/ui/SocialButton.tsx` | Google / Apple outlined buttons |
| `components/onboarding/OnboardingSlide.tsx` | art + gradient + copy block |
| `components/onboarding/Pagination.tsx` | dots + `n/3` counter |
| `features/onboarding/slides.ts` | slide copy and art data |
| `app/onboarding/index.tsx` | carousel |
| `app/auth/sign-in.tsx`, `app/auth/sign-up.tsx` | auth entry screens |

## Screen contract (per AGENTS.md)

- Onboarding: `Screen` with `FULL_BLEED_BOTTOM_SAFE_EDGES`, `padded={false}`,
  non-scroll; bottom clearance from the screen's own `contentStyle`.
- Auth: `Screen scroll` with `STANDALONE_EDGES` and `CENTERED_COLUMN`;
  `KeyboardAvoidingView` with no `keyboardVerticalOffset`.
- No `SafeAreaView` / `useSafeAreaInsets` in any route.
- Sizes from `useResponsive()`; `fontSize` never scaled; text containers use
  `minHeight`. Spacing from the fixed `spacing` scale.

## Typography

Playfair Display Regular/Medium/Bold vendored as static instances in
`assets/fonts/PlayfairDisplay` (not the variable `[wght]` file, which Android
resolves unreliably). Loaded via `useFonts`; the native splash is held until
the fonts resolve so headings never swap typeface mid-view.

## Verification

`npm run typecheck` and `npm run lint` (never `npx tsc` — it resolves a decoy
package in this repo). No test runner is configured, so pure logic is extracted
into testable functions but no tests are written this pass.
