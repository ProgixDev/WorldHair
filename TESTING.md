# WorldHair — Testing

## Accounts

All password `Demo1234!` — one tap via the "Mode démo" bar under the sign-in form.

| Account | State |
|---|---|
| `demo.particulier@worldhair.app` | complete profile → `/discover` |
| `demo.coiffeur.active@worldhair.app` | approved → `/pro/dashboard` |
| `demo.coiffeur.pending@worldhair.app` | application under review |
| `demo.coiffeur.rejected@worldhair.app` | rejected + reason |

Web admin: `admin@admin.com` / `admin123` → `/login`
Catalogue: 26 salons, 8 cities. `coiffeur.<slug>@worldhair.app` / `Demo1234!`

Re-seed: `cd server && bun run seed:admin && bun run seed:demo && bun run seed:catalogue`

---

## Mobile — client (particulier)

**Onboarding (4 slides)** → swipe. Slide 3 = "Activer ma position" (real system prompt) or "Choisir une ville". Slide 4 text + image are editable from `/admin/contenu`.

**Auth** → Google/Apple (⚠️ mocked, fails) or email+password. Sign-up picks Particulier / Coiffeur.
→ **6-digit code** by email (sent by Supabase). Auto-submits on the 6th digit. Resend locked 30 s.
→ **Profile**: first name, last name, photo (optional, uploaded).

**`/discover`** — full-screen map + salon carousel sorted by distance.
- Tapping a pin scrolls the carousel, and the other way round.
- Specialty chips (Tout / coupe / coloration / afro / tresses / barbier / soins / mariage).
- No GPS: location shows "Paris (approx.)" + an "Activer ma position" block.
- Ad banner if `home_banner` is enabled in admin.

**`/search`** — list + filters.
- Text search is accent-insensitive and also matches service names.
- Filters: distance (1/3/5/10 km/Partout) + sort (nearest / best rated / price).
- Badge = active filter count. No filters: 26 salons.
- Ad every 6 results if `search_results` is enabled.

**Salon page** — parallax cover, services, opening hours, map, reviews (yours signed "Vous").

**Booking (4 steps)** — Service → Slot → Payment → Confirmation.
- Struck-through slots = past, already yours, or taken by someone else.
- Payment ⚠️ simulated: 900 ms, always succeeds, card `•••• 4242`.
- End → "**Demande envoyée.**" (status *pending*, the stylist must accept).
- Ad pop-up if `booking_confirmation` is enabled.

**`/appointments`** — tabs Upcoming / History.
- Upcoming → **Modifier** (back into the flow, skips payment) or **Annuler**.
- Past → **Laisser un avis**, then "Avis envoyé".
- Cancelled/refused → greyed out, no actions.

**Review** — 5 stars (required), 7 chips, comment max 500 chars.
Server rejects it if the appointment isn't finished, or is already reviewed.

**`/profile`** — counters, next appointment, visited salons, J-1/H-1 reminders (stored server-side), light/dark/system theme, sign out, "Rejouer l'onboarding".

---

## Mobile — stylist (coiffeur)

**Pro sign-up (4 steps)**
1. Identity — first name, last name, FR phone
2. Salon — name, description
3. Zone — **En salon** (address + postcode + city + company invoice required) or **À domicile** (travel radius in km)
4. Documents — ID + diploma + KBIS, all required, + "I certify" checkbox

→ **`/auth/pending`**: "under review" or "rejected" with the reason the admin typed. Refresh button: as soon as the admin approves, it redirects on its own.

→ **Shop completion** (mandatory, once): cover photo + opening hours. At least one day open. Until it's done the salon is **invisible to booking**.

**`/pro/dashboard`** — 4 KPIs, 8-week bar chart, pending requests, today's appointments, subscription strip.

**`/pro/agenda`** — requests in red at the top → **Accept / Refuse**. Day column where each appointment's height is proportional to its duration. "Horaires" button edits the week (open / close / break).

**`/pro/salon`** — editable public page + service CRUD (name, price, duration). A price changed here shows up on the client side immediately.

**`/pro/reviews`** — reply / edit / delete a reply. Sees every review, including hidden ones.

**`/pro/account`** — Monthly €19 / Yearly €182, cancel, reactivate. ⚠️ no real payment.
Dev tools at the bottom:
- "Simuler J-7" → red strip on the dashboard
- "Simuler expiré" → **the whole pro area is veiled**, "abonnement terminé"
- "Réinitialiser" → fresh 30-day trial

---

## Web

**Landing `/`** — 6 sections, anchors Fonctionnalités / Coiffeurs / Comment ça marche / Avis. Header transparent → navy on scroll. Hamburger below 640 px. "Compte" button → `/login`.
⚠️ `/particuliers`, `/coiffeurs`, legal notice, terms: not built yet.

**`/login`** — a non-admin account is rejected **and signed out**. With no session, every `/admin/*` redirects here.

**`/admin`** — stats + bookings chart (day/week/month).

**`/admin/dossiers`** — tabs Pending / Approved / Rejected. Expanding shows description, phone, 4 document links. **Approve**, or **Reject + reason** (the reason shows word for word on mobile).
⚠️ seeded accounts show documents as "— indisponible", expected, no real files.

**`/admin/comptes`** — Clients / Stylists, search, suspend / ban / reactivate.
Key test: suspend the client account → on mobile **every** action returns 403.

**`/admin/avis`** — reported reviews → hide / restore. Hidden = gone from the public salon page, still visible to the stylist.

**`/admin/publicites`** — 3 placements (home / search / confirmation): active, headline, image, link. Shows on mobile the next time that screen loads.

**`/admin/contenu`** — onboarding slide 4 + preview.

**`/admin/abonnements`** — read-only. Statuses: trial / active / cancelled / **expired** / **not_started**.

**`/admin/parametres`** — email, password, and **admin management restricted to the `admin` tier** (an `admin_limited` gets 403 there, and only there).

---

## End-to-end runs

1. **Stylist**: sign up → 4 steps → pending → admin approves → shop completion → dashboard → create a service → salon appears in `/search`.
2. **Rejection**: admin rejects with a reason → mobile shows that reason → "Modifier mon dossier" → resubmit.
3. **Appointment**: client books → stylist accepts → client reschedules → stylist sees the block move → client cancels.
4. **Review**: past appointment → review → stylist replies → report it (API) → admin hides it → gone from the public page.
5. **Subscription**: simulate J-7 → red strip → simulate expired → pro area blocked → admin sees `expired` → reset.

---

## Mocked — don't report

- **Google / Apple**: no OAuth app registered, the button fails.
- **Service payment**: simulated, always succeeds, no charge and no refund.
- **Subscriptions**: no Apple IAP, no Google Play Billing — only plan/status/dates are real.
- **Slots**: a deterministic mask greys out ~40% of slots on top of the real conflicts.
- **Push**: no `eas.projectId` in `app.json` → token registration fails silently. J-1/H-1 reminders do work server-side.
- **Emails**: `MAIL_TRANSPORT=json` → written to logs, not sent. Except the sign-up code (Supabase, actually sent).
- **Render**: first request after idle takes 30–60 s.

---

## Automated tests

| Command | Expected |
|---|---|
| `cd server && bun run test` | 152 ✅ |
| `cd server && bun run test:e2e` | 42 ✅ |
| `cd mobile && bun run test` | 16 ✅ |
| `cd web && bun run test` | 11 ✅ |

`typecheck` + `lint` green on all three packages.
