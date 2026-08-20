# Espace coiffeur — design

Date: 2026-08-20
Scope: TODO.md → Frontend → "Coiffeur", all seven items.

## Constraints

- Still frontend-only. The pro workspace lives in `services/pro.ts`
  (AsyncStorage), seeded from `features/pro/seed.ts` — same seam as `auth` and
  `booking`.
- The pro account is attached to a catalogue salon (`studio-w`), so its photos,
  rating and client reviews are exactly what a particulier sees.
- Payments are out of scope: the subscription screen moves local state only.
  Apple IAP / Google Play Billing remain on the backend TODO list.

## Navigation

    pro/_layout.tsx          Tabs + ProTabBar (gold)
      dashboard  /pro/dashboard   stats, requests, today
      agenda     /pro/agenda      requests, day column, availability
      salon      /pro/salon       page editor + price list
      reviews    /pro/reviews     answer client reviews
      account    /pro/account     subscription + account

`nextRouteForSession` sends a validated coiffeur to `/pro/dashboard`; the
pending/rejected states still route to `/auth/pending`, and approving from that
screen's demo control seeds the workspace before landing.

The whole `/pro` prefix is immersive in `app/_layout.tsx` — each screen owns its
insets, the tab bar floats.

## Two accents, two spaces

The particulier area is blue-accented, the pro area **gold**: same tokens
(`accent.warm`, `accent.warmSoft`), opposite roles. A coiffeur never has to
wonder which side of the app they are on. The pro tab bar also carries a red
badge with the number of requests still to answer.

## One layout per screen

| Screen | Signature |
|--------|-----------|
| Tableau de bord | KPI grid (2×2), 8-week bar chart, request shortlist, today's chairs, top-services bars |
| Agenda | request cards, then a **real day column**: hour rail, lunch band, bookings drawn as blocks sized by duration |
| Mon salon | cover photo with an overlay picker, a long form, then price-list rows with edit/delete and a sheet editor |
| Avis | conversation threads — review card, indented gold reply, composer in a sheet |
| Compte | plan cards side by side, benefits checklist, billing rows |

Long-pressing a booking in the agenda cancels it; the availability sheet edits
the seven weekdays with switches and 30-minute steppers.

## Data

`features/pro/seed.ts` writes 31 bookings across ±8 weeks: 4 pending requests
(with client notes and a "nouveau client" tag), 9 confirmed, the rest done,
refused or cancelled — enough for the statistics to be meaningful. Clients get
generated avatars, prices and durations come from the salon's own services.

`features/pro/stats.ts` is pure: weekly series, revenue this month, average
basket, acceptance rate, busiest weekday, top services, per-day occupancy.
`contexts/ProContext.tsx` loads the workspace once and every screen and the tab
badge read from it.

## Verification

`npm run typecheck` and `bun expo lint` clean, plus `expo export --platform
android`. Not exercised on a device: the agenda block layout, the cover picker
and the sheets all need a real runtime.
