# Espace particulier — design

Date: 2026-08-20
Scope: TODO.md → Frontend → "Particulier", all seven items.

## Constraints

- Still frontend-only. Salons come from `features/salons/data.ts`; bookings and
  reviews live in `services/booking.ts` (AsyncStorage), same seam pattern as
  `services/auth.ts`.
- `react-native-maps` and `expo-location` are installed. Both ship inside Expo
  Go; a dev build needs a rebuild, and Android needs a real Google Maps key —
  `app.json` still carries `YOUR_GOOGLE_MAPS_API_KEY`.
- Salon cover art is placeholder: the three onboarding photographs, mapped in
  `features/salons/covers.ts`.

## Navigation

    (particulier)/_layout.tsx        Tabs + FloatingTabBar
      discover      /discover        map home
      search        /search          text search
      appointments  /appointments    agenda
      profile       /profile         account

    salon/[id]                       pushed above the tabs
    booking/[salonId]?serviceId&appointmentId
    review/[appointmentId]

`nextRouteForSession` sends an active particulier to `/discover`. The template
screen catalogue that used to live at `/home` is deleted; its useful part (the
demo reset) moved to the profile tab as "Rejouer l'onboarding".

Every particulier route is **immersive** in `app/_layout.tsx`: the root applies
no safe-area padding there, so the map bleeds to the status bar and the tab bar
floats over the gesture area. Each screen adds its own insets.

## One layout per screen (explicit requirement)

The tabs must not read as the same page with different data:

| Screen | Signature |
|--------|-----------|
| Découvrir | full-bleed map, floating header + chips, horizontal snap carousel synced to the pins |
| Recherche | no map: serif title, search pill, dense list with a left distance rail, filters in a bottom sheet |
| Fiche salon | parallax cover, overlapping rounded sheet, rating breakdown bars, docked booking bar |
| Réservation | ticket skin — perforated recap card, day strip, 4-column slot grid, dashed step rail |
| Mes RDV | timeline: date rail + connector line on the left, action cards on the right |
| Avis | centred, single-question page: 40 px stars, tag chips, free-text box |
| Profil | identity block, two stat tiles, grouped settings rows |

The tab bar itself is a floating pill where only the active tab shows its
label, so it never competes with the map.

## Data & logic modules

| File | Responsibility |
|------|----------------|
| `features/salons/types.ts` | Salon, Service, Review, OpeningDay, specialties |
| `features/salons/data.ts` | eight demo salons at real Paris coordinates |
| `features/salons/geo.ts` | haversine, distance formatting, map region framing |
| `features/salons/filters.ts` | pure query/specialty/distance/sort pipeline |
| `features/salons/slots.ts` | opening-hours slot generation, deterministic busy mask |
| `features/salons/cities.ts` | manual-position fallback list |
| `features/salons/mapStyle.ts` | Google map styling, light and dark |
| `services/location.ts` | expo-location wrapper, always resolves to a usable position |
| `contexts/LocationContext.tsx` | position, permission state, manual city override |
| `services/booking.ts` | appointments + reviews store, cancel/reschedule, derived helpers |
| `utils/date.ts` | French date/time/duration/price formatting without ICU |

Slot availability is deterministic (hash of salon id + day + minute), so the
grid never reshuffles between visits — a random mask made the flow feel broken.

## Geolocation

`LocationContext` resolves on mount without prompting (`peekPermission`). Until
the user grants access, `coords` is Paris centre and `isFallback` is true,
which surfaces the "Activer ma position" card over the map. Refusal is not a
dead end: "Choisir une ville" sets a manual position, and the profile tab can
re-trigger the prompt. Distances and sorting work in every state.

## Booking rules

- A slot must fit entirely inside the salon's opening hours.
- Past slots on today are unavailable.
- The user's own confirmed appointments block their slots (minus the one being
  rescheduled).
- Reschedule reuses the same route with `?appointmentId=`, skipping step 1.
- Cancelling keeps the appointment in the history, greyed and labelled.
- A confirmed appointment whose end time has passed counts as done and unlocks
  "Laisser un avis"; once rated, the card shows "Avis envoyé".

User reviews are merged into the salon page above the fixture ones, credited to
"Vous".

## Verification

`npm run typecheck` and `bun expo lint` clean, plus `expo export --platform
android` as a bundle smoke test.
Not yet exercised on a device: the map, the OS location prompt, and the photo
picker all need a real runtime.
