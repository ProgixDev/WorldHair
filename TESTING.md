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

### Onboarding & auth
- [ ] Onboarding, 4 slides, swipe through
- [ ] Slide 3 "Activer ma position" → real system permission prompt appears
- [ ] Slide 3 "Choisir une ville" → alternate path works
- [ ] Slide 4 text/image reflect whatever's set in `/admin/contenu`
- [ ] Sign up with email+password, pick **Particulier**
- [ ] Sign up with email+password, pick **Coiffeur**
- [ ] Google/Apple button — expect it to fail (⚠️ mocked, no OAuth app registered)
- [ ] 6-digit code arrives by email, auto-submits on the 6th digit
- [ ] "Renvoyer le code" locked for 30s, then works
- [ ] Profile setup: first name, last name, photo (optional, uploads)

### `/discover`
- [ ] Full-screen map + salon carousel, sorted by distance
- [ ] Tapping a pin scrolls the carousel to match
- [ ] Scrolling the carousel selects the matching pin
- [ ] Specialty chips filter the list (Tout / coupe / coloration / afro / tresses / barbier / soins / mariage)
- [ ] No GPS → shows "Paris (approx.)" + "Activer ma position" block
- [ ] Ad banner appears only when `home_banner` is enabled in admin

### `/search`
- [ ] Text search is accent-insensitive (e.g. "beaute" finds "beauté")
- [ ] Text search also matches service names, not just salon names
- [ ] Distance filter (1/3/5/10 km/Partout)
- [ ] Sort (nearest / best rated / price)
- [ ] Filter badge shows correct active-filter count
- [ ] No filters → all 26 salons show
- [ ] Ad appears every 6 results when `search_results` is enabled

### Salon page
- [ ] Parallax cover scroll effect
- [ ] Services, opening hours, map, reviews all render
- [ ] Your own review is signed "Vous"

### Booking (4 steps)
- [ ] Service → Slot → Payment → Confirmation, all 4 steps reachable
- [ ] Struck-through slots: past times, already-yours times, taken-by-someone-else times
- [ ] Payment step: simulated (⚠️ 900ms, always succeeds), card `•••• 4242`
- [ ] Ends on "Demande envoyée." — status is *pending*, not confirmed
- [ ] Ad pop-up appears when `booking_confirmation` is enabled

### `/appointments`
- [ ] Upcoming tab: "Modifier" reopens the flow, skips payment
- [ ] Upcoming tab: "Annuler" cancels
- [ ] History tab: "Laisser un avis" → then shows "Avis envoyé"
- [ ] Cancelled/refused appointments greyed out, no action buttons

### Review
- [ ] 5-star rating required, submit blocked without it
- [ ] 7 tag chips, comment field caps at 500 chars
- [ ] Server rejects a review on an unfinished appointment
- [ ] Server rejects a second review on the same appointment

### `/profile`
- [ ] Counters, next appointment, visited salons all populate
- [ ] J-1 / H-1 reminder toggles persist after app restart
- [ ] Theme switch: light / dark / system
- [ ] Sign out works
- [ ] "Rejouer l'onboarding" resets to onboarding screen

---

## Mobile — stylist (coiffeur)

### Sign-up (4 steps)
- [ ] Step 1 Identity — first name, last name, FR phone validated
- [ ] Step 2 Salon — name, description
- [ ] Step 3 Zone, **En salon** — address + postcode + city + invoice required
- [ ] Step 3 Zone, **À domicile** — travel radius in km
- [ ] Step 4 Documents — ID + diploma + KBIS all required, "I certify" checkbox required
- [ ] Lands on `/auth/pending` after submit

### Review states
- [ ] Pending state shown correctly
- [ ] Rejected state shows the exact reason the admin typed
- [ ] Refresh button redirects on its own once admin approves
- [ ] Mandatory shop completion (cover photo + hours, ≥1 day open) — salon invisible to booking until done

### `/pro/dashboard`
- [ ] 4 KPIs populate
- [ ] 8-week bar chart renders
- [ ] Pending requests + today's appointments show
- [ ] Subscription strip shows correct status

### `/pro/agenda`
- [ ] Pending requests in red at top, Accept / Refuse both work
- [ ] Day column blocks sized proportional to appointment duration
- [ ] "Horaires" edits weekly hours (open / close / break)

### `/pro/salon`
- [ ] Public page fields editable and save
- [ ] Service CRUD (create / edit / delete)
- [ ] Price change here reflects immediately on the client side

### `/pro/reviews`
- [ ] Reply to a review
- [ ] Edit an existing reply
- [ ] Delete a reply
- [ ] Hidden reviews still visible here (unlike the public page)

### `/pro/account`
- [ ] Monthly (€19) / Yearly (€182) plan switch
- [ ] Cancel subscription
- [ ] Reactivate subscription
- [ ] Dev tool "Simuler J-7" → red strip appears on dashboard
- [ ] Dev tool "Simuler expiré" → whole pro area veiled, "abonnement terminé"
- [ ] Dev tool "Réinitialiser" → fresh 30-day trial

---

## Web

### Landing `/`
- [ ] 6 sections render, anchors work (Fonctionnalités / Coiffeurs / Comment ça marche / Avis)
- [ ] Header goes transparent → navy on scroll
- [ ] Hamburger menu appears below 640px
- [ ] "Compte" button → `/login`
- [ ] ⚠️ `/particuliers`, `/coiffeurs`, legal notice, terms — not built yet, don't expect them

### `/login`
- [ ] Non-admin account rejected **and** signed out
- [ ] No session → every `/admin/*` redirects here

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
- [ ] **Subscription**: simulate J-7 → red strip → simulate expired → pro area blocked → admin sees `expired` → reset

---

## Mocked — don't report as bugs

- **Google / Apple**: no OAuth app registered, the button fails.
- **Service payment**: simulated, always succeeds, no charge and no refund.
- **Subscriptions**: no Apple IAP, no Google Play Billing — only plan/status/dates are real.
- **Slots**: a deterministic mask greys out ~40% of slots on top of the real conflicts.
- **Push**: no `eas.projectId` in `app.json` → token registration fails silently. J-1/H-1 reminders do work server-side.
- **Emails**: sent via Resend + a Supabase "Send Email" hook. Only sends to real inboxes once `worldhair.app` is verified in Resend — until then, sending is limited to the Resend account's own registered address.
- **Render**: first request after idle takes 30–60s.

---

## Automated tests

| Command | Expected |
|---|---|
| `cd server && bun run test` | 171 ✅ |
| `cd server && bun run test:e2e` | 46 ✅ |
| `cd mobile && bun run test` | 16 ✅ |
| `cd web && bun run test` | 11 ✅ |

`typecheck` + `lint` green on all three packages.
