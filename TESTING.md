# WorldHair — Testing

## Accounts

All password `Demo1234!` — one tap via the "Mode démo" bar under the sign-in form (development builds only; a release APK has no demo bar, type the email instead).

| Account | State |
|---|---|
| `demo.particulier@worldhair.app` | complete profile → `/discover` |
| `demo.coiffeur.active@worldhair.app` | approved → `/pro/dashboard` |
| `demo.coiffeur.pending@worldhair.app` | application under review |
| `demo.coiffeur.rejected@worldhair.app` | rejected + reason |

Web admin: `admin@admin.com` / `admin123` → `/login`
Catalogue: 26 salons, 8 cities. `coiffeur.<slug>@worldhair.app` / `Demo1234!`
Review authors: 6 clients, `client.<name>@worldhair.app` / `Demo1234!` — they wrote the catalogue's real reviews (3 to 6 per salon).

Re-seed: `cd server && bun run seed:admin && bun run seed:demo && bun run seed:catalogue`
⚠️ `seed:demo` resets the 4 demo accounts to the states above and replaces every appointment between demo.particulier and demo.coiffeur.active.

---

## Mobile — client (particulier)

### Onboarding & auth
- [x] Onboarding, 4 slides, swipe through
- [x] Slide 3 "Activer ma position" → real system permission prompt appears
- [x] Slide 3 "Choisir une ville" → alternate path works
- [x] Slide 4 text/image reflect whatever's set in `/admin/contenu`
- [x] Sign up with email+password, pick **Particulier**
- [x] Sign up with email+password, pick **Coiffeur**
- [ ] No Google/Apple buttons on sign-in or sign-up (email + password only)
- [x] 6-digit code arrives by email, auto-submits on the 6th digit
- [x] "Renvoyer le code" locked for 30s, then works
- [x] Profile setup: first name, last name, photo (optional, uploads)

### `/discover`
- [x] Full-screen map + salon carousel, sorted by distance
- [x] Tapping a pin scrolls the carousel to match
- [x] Scrolling the carousel selects the matching pin
- [x] Specialty chips filter the list (Tout / coupe / coloration / afro / tresses / barbier / soins / mariage)
- [x] No GPS → shows "Paris (approx.)" + "Activer ma position" block
- [x] Ad banner appears only when `home_banner` is enabled in admin

### `/search`
- [x] Text search is accent-insensitive (e.g. "beaute" finds "beauté")
- [x] Text search also matches service names, not just salon names
- [x] Distance filter (1/3/5/10 km/Partout)
- [x] Sort (nearest / best rated / price)
- [x] Filter badge shows correct active-filter count
- [x] No filters → all 26 salons show
- [x] Ad appears every 6 results when `search_results` is enabled
- [ ] Ratings are real: each catalogue salon shows its average and review count (e.g. "4,8 (6)"); a salon with no review shows « Nouveau »
- [ ] "Mieux notés" puts salons without reviews last

### Salon page
- [x] Parallax cover scroll effect
- [x] Services, opening hours, map, reviews all render
- [x] Your own review is signed "Vous"
- [ ] A salon with no review shows « Nouveau » in the header and "Pas encore d'avis…" instead of the rating summary

### Booking (4 steps)
- [x] Service → Slot → Payment → Confirmation, all 4 steps reachable
- [x] Struck-through slots: past times, already-yours times, taken-by-someone-else times
- [ ] No random busy slots: on an empty day every slot is free
- [ ] Every start that would overlap an existing booking is struck through (not only its start time), and so is the lunch break
- [ ] First slot of the day (e.g. 9:00) can be booked — the server reads hours on a Paris clock
- [x] Payment step: simulated (⚠️ 900ms, always succeeds), card `•••• 4242`
- [x] Ends on "Demande envoyée." — status is *pending*, not confirmed
- [x] Ad pop-up appears when `booking_confirmation` is enabled

### `/appointments`
- [x] Upcoming tab: "Modifier" reopens the flow, skips payment
- [x] Upcoming tab: "Annuler" cancels
- [x] History tab: "Laisser un avis" → then shows "Avis envoyé"
- [x] Cancelled/refused appointments greyed out, no action buttons
- [ ] Push when the salon refuses the request or cancels the appointment (needs push working, see "Mocked")

### Review
- [x] 5-star rating required, submit blocked without it
- [x] 7 tag chips, comment field caps at 500 chars
- [x] Server rejects a review on an unfinished appointment
- [x] Server rejects a second review on the same appointment

### `/profile`
- [x] Counters, next appointment, visited salons all populate
- [x] J-1 / H-1 reminder toggles persist after app restart
- [x] Theme switch: light / dark / system
- [x] Sign out works
- [x] "Rejouer l'onboarding" resets to onboarding screen

---

## Mobile — stylist (coiffeur)

### Sign-up (4 steps)
- [x] Step 1 Identity — first name, last name, FR phone validated
- [x] Step 2 Salon — name, description
- [x] Step 3 Zone, **En salon** — address + postcode + city + invoice required
- [x] Step 3 Zone, **À domicile** — travel radius in km
- [x] Step 4 Documents — ID + diploma + KBIS all required, "I certify" checkbox required
- [x] Lands on `/auth/pending` after submit

### Review states
- [x] Pending state shown correctly
- [x] Rejected state shows the exact reason the admin typed
- [x] Refresh button redirects on its own once admin approves
- [x] Mandatory shop completion (cover photo + hours, ≥1 day open) — salon invisible to booking until done

### `/pro/dashboard`
- [x] 4 KPIs populate
- [x] 8-week bar chart renders
- [x] Pending requests + today's appointments show
- [x] Subscription strip shows correct status

### `/pro/agenda`
- [x] Pending requests in red at top, Accept / Refuse both work
- [x] Day column blocks sized proportional to appointment duration
- [x] "Horaires" edits weekly hours (open / close / break)
- [ ] A request whose time has already passed can no longer be accepted (server says it expired)
- [ ] A past appointment can't be cancelled (so the client can still review it)
- [ ] Push when the client moves an appointment, with the new date (needs push working, see "Mocked")

### `/pro/salon`
- [x] Public page fields editable and save
- [x] Service CRUD (create / edit / delete)
- [x] Price change here reflects immediately on the client side

### `/pro/reviews`
- [x] Reply to a review
- [x] Edit an existing reply
- [x] Delete a reply
- [x] Hidden reviews still visible here (unlike the public page)

### `/pro/account`
- [x] Monthly (€19) / Yearly (€182) plan switch
- [x] Cancel subscription
- [x] Reactivate subscription
- [ ] No "Développement" section any more (the J-7 / expired simulators wrote the subscription directly, which the database now refuses)

---

## Web

### Landing `/`
- [x] 6 sections render, anchors work (Fonctionnalités / Coiffeurs / Comment ça marche / Avis)
- [x] Header goes transparent → navy on scroll
- [x] Hamburger menu appears below 640px
- [x] "Compte" button → `/login`
- [ ] ⚠️ `/particuliers`, `/coiffeurs`, legal notice, terms — not built yet, don't expect them

### `/login`
- [x] Non-admin account rejected **and** signed out
- [x] No session → every `/admin/*` redirects here

### `/admin`
- [ ] Stats + bookings chart (day/week/month toggle)

### `/admin/dossiers`
- [ ] Pending / Approved / Rejected tabs
- [ ] Expanding a dossier shows description, phone, 4 document links
- [ ] Approve works
- [ ] Reject + reason works, reason shows word-for-word on mobile
- [ ] ⚠️ seeded accounts show "— indisponible" for documents — expected, no real files

### `/admin/comptes`
- [ ] Client / Stylist tabs, search works
- [ ] Suspend / ban / reactivate all work
- [ ] **Key test**: suspend the client account → on mobile, every action returns 403
- [ ] Suspend a stylist → their salon disappears from `/discover` and `/search`, its page and booking return "not found"; reactivate → back

### `/admin/avis`
- [ ] Reported reviews list
- [ ] Hide → gone from public salon page, still visible to stylist
- [ ] Restore → back on public page

### `/admin/publicites`
- [ ] All 3 placements editable (home / search / confirmation)
- [ ] Toggling active shows/hides on mobile next screen load

### `/admin/contenu`
- [ ] Onboarding slide 4 edits + preview matches

### `/admin/abonnements`
- [ ] Read-only list, all 5 statuses represented correctly (trial / active / cancelled / expired / not_started)

### `/admin/parametres`
- [ ] Email change
- [ ] Password change
- [ ] Admin management works for `admin` tier
- [ ] Admin management returns 403 for `admin_limited`

---

## End-to-end runs

- [ ] **Stylist**: sign up → 4 steps → pending → admin approves → shop completion → dashboard → create a service → salon appears in `/search`
- [ ] **Rejection**: admin rejects with a reason → mobile shows that reason → "Modifier mon dossier" → resubmit
- [ ] **Appointment**: client books → stylist accepts → client reschedules → stylist sees the block move → client cancels
- [ ] **Review**: past appointment → review → stylist replies → report it (API) → admin hides it → gone from the public page
- [ ] **Subscription**: waits for Stripe (TODO.md Phase 4) — the in-app simulators are gone; until then J-7 / expired can only be forced in the dev database

---

## Mocked — don't report as bugs

- **Service payment**: simulated, always succeeds, no charge and no refund (real payment: TODO.md Phase 5).
- **Subscriptions**: no Stripe yet (TODO.md Phase 4) — only plan/status/dates are real.
- **Push**: no `eas.projectId` in `app.json` → token registration fails silently. Every notification is created server-side (see `notifications_log`) but can't reach a phone until `eas init` is run with the WorldHair Expo account.
- **Emails**: sent via Resend + a Supabase "Send Email" hook. Only sends to real inboxes once `worldhair.app` is verified in Resend — until then, sending is limited to the Resend account's own registered address.
- **Render**: first request after idle takes 30–60s.

---

## Automated tests

| Command | Expected |
|---|---|
| `cd server && bun run test` | 210 ✅ (runs in UTC, like Render) |
| `cd server && bun run test:e2e` | 52 ✅ |
| `cd server && bun run check:rls` | "All checks passed" — the app's public key can't write around the API (live dev database) |
| `cd mobile && bun run test` | 49 ✅ |
| `cd web && bun run test` | 11 ✅ |

`typecheck` + `lint` green on all three packages.
