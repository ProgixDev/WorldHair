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
Coiffeurs sign in on the same `/login` and land on `/pro/abonnement` (their subscription). After `seed:demo` / `seed:catalogue`, seeded salons have an **offered** subscription (a year, no Stripe) so they stay listed; subscribing through Stripe replaces it.
Catalogue: 26 salons, 8 cities. `coiffeur.<slug>@worldhair.app` / `Demo1234!`
Review authors: 6 clients, `client.<name>@worldhair.app` / `Demo1234!` — they wrote the catalogue's real reviews (3 to 6 per salon).

Re-seed: `cd server && bun run seed:admin && bun run seed:demo && bun run seed:catalogue`
⚠️ `seed:demo` resets the 4 demo accounts to the states above and replaces every appointment between demo.particulier and demo.coiffeur.active.
Payments (TODO.md Phase 5): Studio W, the demo salon, takes bookings and payments in the app without its own Stripe account (its money waits with WorldHair); the 26 catalogue salons read « Réservation en ligne bientôt disponible » until each sets up its payouts. Stripe test cards: `4242 4242 4242 4242` (paid), `4000 0025 0000 3155` (asks for 3-D Secure), `4000 0000 0000 0002` (declined) — any future date, any CVC.
After `seed:demo`, Studio W (demo.coiffeur.active) has: a pending request at J+2 10:00, a 2-prestation booking at J+5 14:30 (Coloration complète + Soin fondant), two past bookings (J-6 unmarked, J-13 marked « Honoré »), a « Formation » closure on J+8 from 14:00 to 19:00 and « Congés » on J+15 and J+16 (J = the day you ran the seed).

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
- [ ] Sign-up: « conditions générales » and « politique de confidentialité » open the site's pages in the app; the new account records the version accepted (no « Nos conditions évoluent » after it)
- [ ] An account made before the CGU (any test account not from the seeds): « Nos conditions évoluent » covers the app; the two links open the pages; « J'accepte » lets you in and it doesn't come back; « Se déconnecter » signs out

### `/discover`
- [x] Full-screen map + salon carousel, sorted by distance
- [x] Tapping a pin scrolls the carousel to match
- [x] Scrolling the carousel selects the matching pin
- [x] Specialty chips filter the list (Tout / coupe / coloration / afro / tresses / barbier / soins / mariage)
- [x] No GPS → shows "Paris (approx.)" + "Activer ma position" block
- [x] Ad banner appears only when `home_banner` is enabled in admin
- [ ] Opens framed on the nearest salons; drag or zoom the map to another city (e.g. Lyon) → its salons appear on the map and in the carousel a moment after the map settles
- [ ] Tapping a pin or swiping the carousel moves the map but doesn't reshuffle the cards; after that, zooming out stays zoomed out (the map doesn't fly back to the salon)
- [ ] Cards: heart (fills red, stays after reopening the app), « Dispo aujourd'hui 14:30 » line on Studio W (catalogue salons can't be booked online yet: no line), « À domicile · 25 km » on Salon Céleste

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
- [ ] Filters run on the server (TODO.md Phase 6): « Voir N salons » counts a moment after each change; the list pages in as you scroll (no cap at 100)
- [ ] Several prestation chips at once show salons offering any of them; the text also finds a coiffeur's first name, a city or a prestation ("balayage lyon")
- [ ] « Budget »: « Moins de 30 € » keeps salons with a visible prestation under 30 € (Studio W's hidden « Lissage brésilien » never counts)
- [ ] « Quand »: « Ouvert maintenant » (none on Sunday), a day (a salon closed that day, or on leave all of it, drops out), « Ouvert après 19 h »
- [ ] « Où »: « À domicile » from Paris shows Salon Céleste only (Azur Mariage doesn't travel that far) — even with « Distance maximale » 1 km, since she comes to the client
- [ ] « Disponible au plus tôt » puts Studio W first (the only salon bookable online), with its « Dispo … » line

### Salon page
- [x] Parallax cover scroll effect
- [x] Services, opening hours, map, reviews all render
- [x] Your own review is signed "Vous"
- [ ] A salon with no review shows « Nouveau » in the header and "Pas encore d'avis…" instead of the rating summary
- [ ] "Réservation" block lists the salon's 3 rules — for Studio W with default settings: "Réservable jusqu'à 1 h avant", "Annulation ou modification jusqu'à 1 jour avant", "Le salon confirme chaque demande"
- [ ] Change the rules in `/pro/salon` → the block follows ("Réservable jusqu'au dernier moment", "Confirmation immédiate"…)
- [ ] Heart at the top right adds or removes the salon from « Favoris » (clients only)
- [ ] Studio W: Instagram and TikTok icons under the description open the links; « Dispo … » under the rating; a home-service salon reads « À domicile · N km »
- [ ] A hidden service (Studio W's « Lissage brésilien ») is nowhere: not in the list, not in « dès … »
- [ ] Flag on someone else's review → « Signaler cet avis »: a reason (+ optional words) → « Envoyer le signalement » → it reads « · Signalé », also after reopening; your own review has no flag; it appears in `/admin/avis`

### Booking (4 steps)
- [x] Service → Slot → Payment → Confirmation, all 4 steps reachable
- [x] Struck-through slots: past times, already-yours times, taken-by-someone-else times
- [ ] No random busy slots: on an empty day every slot is free
- [ ] Every start that would overlap an existing booking is struck through (not only its start time), and so is the lunch break
- [ ] First slot of the day (e.g. 9:00) can be booked — the server reads hours on a Paris clock
- [ ] Several prestations: tick 2 → the bar shows the summed price and duration; the grid only offers starts where the whole block fits before closing / the break / the next booking
- [ ] The 2-prestation booking is one block of the summed duration, at the summed price, in "Mes rendez-vous" and in the coiffeur agenda ("Coloration complète + Soin fondant")
- [ ] Booking notice: with 1 h, no slot starting less than 1 h from now is offered (today's first free slot is at least 1 h away)
- [ ] Closures: the « Congés » days (J+15, J+16) are greyed and read « Fermé » in the day strip; on J+8 no slot overlaps 14:00–19:00 (« Formation »)
- [ ] Two phones on the same slot: the second one gets "Ce créneau n'est plus disponible. Choisissez un autre horaire." and the grid reloads with that slot struck through
- [ ] Recap step shows the salon's cancellation rule and confirmation mode
- [ ] Steps are Prestation → Créneau → Paiement; the Paiement step shows the recap, the salon's rules and « Remboursé intégralement si le salon refuse ou annule… »
- [ ] « Payer 40 € » opens Stripe's payment page in the browser (salon, prestations, day and time, 40 €, button « Réserver »; the email is already filled in); `4242…` → « Paiement reçu » → back in the app on its own → « Demande envoyée. » + « Paiement reçu. Le salon doit encore confirmer votre créneau. »; the salon sees the request only now
- [ ] `4000 0025 0000 3155` asks for 3-D Secure on Stripe's page, then back in the app as above; `4000 0000 0000 0002` is declined on Stripe's page, nothing is booked, another card can be tried there
- [ ] Closing Stripe's page (✕ or back) → « Paiement non finalisé… » in the app; « Payer » again reopens the same page (same held slot); going back to the grid frees the slot at once (another phone can take it)
- [ ] If the browser doesn't return to the app on its own, « Retourner dans l'application » does, and the booking shows as sent
- [ ] Going back from Paiement and picking another time — even one overlapping the first — works at once, and your own first time shows free on the grid
- [ ] Leave the Paiement step open 11+ minutes, then « Payer »: the sheet opens and pays normally (a fresh hold is taken)
- [ ] iPhone: no « … wants to use stripe.com to sign in » prompt before Stripe's page; after paying, back in the app on the booking screen (no blank or "not found" screen)
- [ ] Someone takes the slot while you're on Paiement → « Ce créneau n'est plus disponible… » and back to the refreshed grid, nothing charged
- [ ] Stripe emails the receipt (live mode only: test mode sends none)
- [ ] A catalogue salon's page reads « Réservation en ligne bientôt disponible » (button disabled)
- [ ] Salon set to « Confirmées d'office »: ends on "C'est réservé." + "Le salon a confirmé votre rendez-vous.", the booking is confirmed straight away (no request in the coiffeur's red list)
- [x] Ad pop-up appears when `booking_confirmation` is enabled

### `/appointments`
- [ ] A paid booking reads « Payé 40 € »; after a refund « Remboursé 40 € » (green) or « Remboursé 15 € sur 40 € », with a push each time
- [ ] Cancelling in time, or the salon refusing or cancelling → full refund automatically
- [ ] A request the salon never answers → at its start time it reads « Annulé », fully refunded, push « Demande sans réponse »
- [x] Upcoming tab: "Modifier" reopens the flow, skips payment
- [x] Upcoming tab: "Annuler" cancels
- [x] History tab: "Laisser un avis" → then shows "Avis envoyé"
- [x] Cancelled/refused appointments greyed out, no action buttons
- [ ] Upcoming card reads "Modifiable ou annulable jusqu'à …" (the salon's cancellation deadline)
- [ ] Past that deadline, "Modifier" and "Annuler" are gone and the card reads "Le délai fixé par le salon pour modifier ou annuler est passé." (accepted bookings only — with 1 jour, the J+5 14:30 booking after J+4 14:30)
- [ ] "Modifier" offers no slot inside the booking notice either
- [ ] A booking the salon marked « Absent » reads "Le salon a signalé une absence à ce rendez-vous." and offers no review
- [ ] A booking the salon moved reads "Horaire déplacé par le salon." and stays "Modifier" / "Annuler" until it starts, even inside the salon's deadline; once the client picks a new time themselves, the deadline applies again
- [ ] Lengthening the cancellation deadline in `/pro/salon` doesn't move an accepted booking's "Modifiable ou annulable jusqu'à …" time (only bookings made afterwards follow the new setting)
- [ ] A request the salon hasn't accepted yet can be withdrawn until it starts, whatever the deadline
- [ ] Push when the salon refuses the request or cancels the appointment (needs push working, see "Mocked")
- [ ] Cancelled cards say who: « Annulé par vous », « Annulé par le salon », « Sans réponse du salon »; one WorldHair cancelled reads « Annulé par WorldHair » and « Motif : … » (after `seed:demo`: J-9)

### Review
- [x] 5-star rating required, submit blocked without it
- [x] 7 tag chips, comment field caps at 500 chars
- [x] Server rejects a review on an unfinished appointment
- [x] Server rejects a second review on the same appointment
- [ ] Server rejects a review on an appointment marked « Absent »

### `/profile`
- [x] Counters, next appointment, visited salons all populate
- [ ] « FAVORIS » (after `seed:demo`: Studio W, Racines, Maison Tresse), the latest first; the heart on a tile removes it; empty → « Touchez le cœur d'un salon pour le retrouver ici. » A home-service favorite (heart Azur Mariage, in Marseille) stays listed from Paris
- [x] J-1 / H-1 reminder toggles persist after app restart
- [x] Theme switch: light / dark / system
- [x] Sign out works
- [x] "Rejouer l'onboarding" resets to onboarding screen
- [ ] « Mes données › Exporter mes données » → the share sheet with a JSON (account, bookings, reviews, favorites, reminders)
- [ ] « Informations légales » opens the CGU, the privacy policy and the legal notice
- [ ] « Supprimer mon compte » (a throwaway account with a paid booking to come and a past one) → the sheet says what happens → « Supprimer définitivement » → signed out, « Compte supprimé »; the booking to come is cancelled and refunded, and the salon gets « Rendez-vous annulé »; in the salon's agenda the past booking reads « Client supprimé »; signing in again fails

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
- [ ] Two more: « Remplissage cette semaine » (accepted bookings over this week's open hours, lunch and closures left out) and « N avis reçus » with the average (the same as clients see)
- [x] 8-week bar chart renders
- [ ] Caption shows "Absences : X %" once a past booking is marked; top services count each prestation of a 2-prestation booking on its own
- [x] Pending requests + today's appointments show
- [x] Subscription strip shows correct status
- [ ] Strip reads the new states: « Fiche pas encore en ligne » (never subscribed), « Essai gratuit », « Abonnement actif » / « Abonnement offert », « Abonnement résilié », « Paiement refusé », « Il vous reste N jours d'abonnement » in the last week; a tap opens the account tab
- [ ] Subscription cancelled with bookings after its end date: the strip adds « N rendez-vous sont prévus après cette date : pensez à les annuler ou à les déplacer », and clients can't book any time after it (those days read « Fermé »)

### `/pro/agenda`
- [x] Pending requests in red at top, Accept / Refuse both work
- [x] Day column blocks sized proportional to appointment duration
- [x] "Horaires" edits weekly hours (open / close / break)
- [ ] A request whose time has already passed can no longer be accepted (server says it expired)
- [ ] A past appointment can't be cancelled (so the client can still review it)
- [ ] Push when the client moves an appointment, with the new date (needs push working, see "Mocked")
- [ ] Tap a booking → sheet with the client, every prestation, price and duration
- [ ] Confirmed upcoming booking → "Déplacer" → slot picker (the salon's own notice doesn't apply) → "Déplacer ici" → the block moves; the client sees the new time (push once push works)
- [ ] A pending request has no "Déplacer", only "Refuser" / "Accepter"
- [ ] "LE CLIENT EST-IL VENU ?" lists past bookings not yet marked (after seed: J-6); « Honoré » / « Absent » removes it from the list; the choice can be changed from the booking's sheet, which updates at once
- [ ] « Absent » on a booking the client already reviewed → "Le client a déjà laissé un avis sur ce rendez-vous : il ne peut plus être marqué absent."
- [ ] An appointment that has started can no longer be moved (no "Déplacer")
- [ ] "Déplacer ici" on a time someone took meanwhile → "Ce créneau est déjà pris." and the grid reloads with that time struck through
- [ ] « Fermetures » → add by whole days (from / to) or by hours on one day, with an optional label → listed, drawn in the day column; a whole-day closure shows "Fermé ce jour-là · <label>. Aucune réservation possible."
- [ ] Adding a closure over existing bookings warns "N rendez-vous pendant cette fermeture" and lists them — they stay booked, nothing is cancelled
- [ ] Deleting a closure makes its slots bookable again on the client side

### `/pro/salon`
- [x] Public page fields editable and save
- [x] Service CRUD (create / edit / delete)
- [x] Price change here reflects immediately on the client side
- [ ] "RÉSERVATION": « Je valide » / « Confirmées d'office », then both deadlines with the presets (À tout moment, 30 min, 1 h, 2 h, 12 h, 1 jour, 2 jours) → saved, and shown on the client's salon page
- [ ] « Réseaux sociaux »: « @studio.w » for Instagram saves as its link; a Facebook link in the Instagram field → « Ce lien Instagram ne mène pas à Instagram. »; emptying a field removes its icon from the public page
- [ ] Edit a service → « Visible par les clients » off → saved, the row dims and reads « · Masquée »; gone from the public page, « dès … » and booking; switch it back on → back

### `/pro/reviews`
- [x] Reply to a review
- [x] Edit an existing reply
- [x] Delete a reply
- [x] Hidden reviews still visible here (unlike the public page), marked « Masqué par WorldHair », and left out of the average
- [ ] Flag on a review → reason → sent → « Signalé »; a second report of the same review isn't possible; a salon can't report another salon's reviews

### `/pro/payments` (Compte → Encaissements → Paiements)
- [ ] Demo salon: « Salon de démonstration » + « Configurer mes paiements »
- [ ] A catalogue salon (`coiffeur.<slug>@worldhair.app`): « Réservations en ligne fermées » → « Configurer mes paiements » opens Stripe's onboarding in the browser (test mode: use Stripe's test data and « Skip this form » where offered) → back in the app through `/connect/retour` → « Paiements actifs »; the salon becomes bookable in the client app
- [ ] « Voir mes versements sur Stripe » opens the Express dashboard
- [ ] « Réservations payées » lists each paid booking: amount, refunds, commission, « versement de 36 € prévu le … » then « versé … le … »
- [ ] Dashboard shows « Réservations en ligne fermées » while payouts aren't set up; revenue counts what clients kept after refunds

### Booking sheet (agenda → tap a paid booking)
- [ ] « PAIEMENT » shows paid / refunded / your share / commission
- [ ] A cancelled booking says who (« Annulé par le client », « Annulé par vous », « Annulé par WorldHair » with « Motif : … »)
- [ ] Refund part of it (e.g. 15) → confirm → the client is refunded, the sheet updates; more than what's left is refused; after the payout the refund is refused (« Le montant vous a déjà été versé… »)

### `/pro/account`
- [ ] No "Développement" section any more (the J-7 / expired simulators wrote the subscription directly, which the database now refuses)
- [ ] Status only: state card, « Fiche visible par les clients » Oui/Non, formule, the next date (premier prélèvement / prochain prélèvement / fiche visible jusqu'au). No price, no plan to pick, no cancel or reactivate button, no link to pay
- [ ] « Actualiser le statut » picks up a subscription just made on the website
- [ ] Ended subscription (Stripe says canceled or unpaid): the « Abonnement terminé » veil covers the pro area; « Actualiser » lifts it once the website subscription is active, and says « Toujours aucun abonnement actif » otherwise
- [ ] No text in the app tells where or how to pay (no email, website or link mentioned): App Store rule 3.1.3
- [ ] A salon that never subscribed is **not** veiled (it must still set up its page), but it's absent from search and its page 404s
- [ ] « Mes données »: the export has the salon too (dossier, page, prestations, hours, closures, subscription, bookings, reviews received)
- [ ] « Supprimer mon compte » (a throwaway salon with a paid booking to come and one from earlier today): its client is refunded and gets « Rendez-vous annulé »; today's booking is paid out at once (Stripe › transfers); its Stripe customer is gone (subscription ended); the salon disappears from search; the client's history shows « Salon supprimé »
- [ ] Stripe unreachable during a salon's deletion → « Votre compte n'a pas pu être supprimé pour l'instant : rien n'a été effacé » — trying again later goes through

---

## Web

### Landing `/`
- [x] 6 sections render, anchors work (Fonctionnalités / Coiffeurs / Comment ça marche / Avis)
- [x] Header goes transparent → navy on scroll
- [x] Hamburger menu appears below 640px
- [x] "Compte" button → `/login`
- [ ] Footer › CGU / Confidentialité / Mentions légales → `/cgu`, `/confidentialite`, `/mentions-legales`; the company's details show highlighted « [… à compléter] » until filled in `web/src/content/legal/company.ts`; the header's links go back to the home page's sections
- [ ] ⚠️ `/particuliers`, `/coiffeurs` — not built yet (Phase 9), don't expect them

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
- [ ] 90 days after a rejection, the daily job (3:00) deletes that dossier's documents: links read "— indisponible", the app's dossier reads « Supprimés après 90 jours : à renvoyer », and resubmitting sends them again
- [ ] ⚠️ seeded accounts show "— indisponible" for documents — expected, no real files

### `/admin/comptes`
- [ ] Client / Stylist tabs, search works
- [ ] Suspend / ban / reactivate all work
- [ ] **Key test**: suspend the client account → on mobile, every action returns 403
- [ ] Suspend a stylist → their salon disappears from `/discover` and `/search`, its page and booking return "not found"; reactivate → back

### `/admin/avis`
- [ ] « Signalés »: each review with its salon, its author's full name and every report — reason (the app's words), who (a client by name, a salon by its name) and when, their words in quotes (after `seed:demo`: Studio W's latest review, 2 reports)
- [ ] Hide → gone from public salon page, still visible to stylist, now under « Masqués »
- [ ] « Marquer comme sûr » → off the list, still on the public page; the same person reporting it again (API) doesn't bring it back — someone else's report does
- [ ] « Masqués » → « Remettre en ligne » → back on the public page and in the salon's average

### `/admin/rendez-vous`
- [ ] Every booking, the latest first: client → salon, date, prestations, price, status (Demande en attente / Confirmé / Terminé / Client absent / Refusé par le salon / Annulé par le client / le salon / WorldHair / Expiré sans réponse) and payment (Payé / Versé au salon / Remboursé… / Sans paiement en ligne)
- [ ] Filters: status, salon, client (« coupe carre » finds « Coupe Carré »), from / to days — 20 per page with the total; « Effacer les filtres »; back from a booking returns to the same filtered list
- [ ] A booking: date, prestations, the client (email) and the salon (city, phone, email) linking to their accounts, the payment (paid, refunded, commission, paid out, Stripe reference)
- [ ] « Annuler le rendez-vous (litige) » → reason (3 characters at least) → confirm → « Rendez-vous annulé, 40,00 € remboursés au client. »; the client and the salon each get « Rendez-vous annulé par WorldHair » with the reason (see `notifications_log`), and the app shows it on the booking
- [ ] Cancelling after the payout: the salon's share comes back first (a transfer reversal in Stripe), then the client gets everything left
- [ ] Stripe down during a cancel → « Rendez-vous annulé, mais le client n'a pas pu être remboursé pour l'instant… » → « Rembourser le reste » refunds it
- [ ] A booking cancelled here is never paid out to the salon afterwards, even if the hourly payout run had already listed it
- [ ] A cancelled or refused booking has no « Annuler »; `admin_limited` can cancel too
- [ ] `/admin/paiements` → « Voir le rendez-vous » opens the booking

### `/admin/publicites`
- [ ] All 3 placements editable (home / search / confirmation)
- [ ] Toggling active shows/hides on mobile next screen load

### `/admin/contenu`
- [ ] Onboarding slide 4 edits + preview matches

### `/admin/abonnements`
- [ ] Read-only list with the state (Pas d'abonnement / Essai / Actif / Résilié (fin prévue) / Paiement refusé / Paiement en attente / Terminé), the plan or « Offert », and the date that matters
- [ ] The arrow opens the coiffeur's customer in Stripe (test dashboard while in test mode)
- [ ] ⚠️ Suspending or banning a coiffeur doesn't stop Stripe: their subscription keeps billing until cancelled from that Stripe link

### `/admin/paiements`
- [ ] Totals: encaissé, remboursé, commission (on payments already paid out), versé aux salons
- [ ] Each payment: client → salon, date, amount, state (Payé / Versé au salon / Remboursé / Remboursé en partie / Abandonné / En attente)
- [ ] « Rembourser » → amount (empty = everything left) → the client is refunded; after a payout the salon's share is taken back first (visible in Stripe's dashboard as a transfer reversal)
- [ ] After a payout of 36 € on 40 €, three refunds of 13,33 / 13,33 / 13,34 all go through, and the three reversals add up to exactly 36 €; the list then shows 0 € kept by the salon

### `/admin/parametres`
- [ ] « Commission sur les prestations payées »: shows 10, save 12,5 → the next payments keep 12,5 %; an empty field is refused
- [ ] « Période d'essai des coiffeurs »: shows 30, save 14 → the next Checkout offers 14 days; 0 → no trial; 400 or an empty field refused
- [ ] Email change
- [ ] Password change
- [ ] Admin management works for `admin` tier
- [ ] Admin management returns 403 for `admin_limited`

### Coiffeur — `/pro/abonnement`
- [ ] Signed out → `/pro/abonnement` sends to `/login`, and back to the page after signing in; a client account is refused on `/login`
- [ ] Coiffeur not validated yet → « Dossier en cours de validation », no plan to pick
- [ ] Validated, never subscribed → « Votre salon n'est pas encore en ligne », both prices read from Stripe (19 € / 182 €, « 2 mois offerts »), « 30 jours d'essai gratuit, puis … »
- [ ] « Continuer vers le paiement » → Stripe Checkout (French) → card `4242 4242 4242 4242`, any future date, any CVC → back on the page with « Merci ! … » and no pay button while Stripe confirms → within seconds « Essai gratuit en cours », visible: oui → the salon is back in the app's search
- [ ] A seeded salon (« Abonnement offert ») that subscribes keeps its offered year: Checkout shows the first charge at the end of it
- [ ] Two tabs on Checkout: paying in one closes the other; « Continuer vers le paiement » again after paying → « Vous avez déjà un abonnement en cours »
- [ ] « Annuler » on Checkout → « Paiement annulé : rien n'a été débité. »
- [ ] « Ouvrir la gestion de l'abonnement » → Stripe's portal: switch monthly ↔ yearly, change card, see invoices, cancel → back: « Abonnement résilié », still visible until the date shown; « Renouveler » in the portal undoes it
- [ ] A second subscription after one ended gets no free trial

---

## Stripe (test mode) — set up once

- [ ] `STRIPE_SECRET_KEY` (sk_test_…) in `server/.env` and on Render; `WEB_APP_URL` = the website's URL
- [ ] `cd server && bun run stripe:setup -- --webhook-url https://worldhair-server.onrender.com/webhooks/stripe` → prints `STRIPE_WEBHOOK_SECRET=whsec_…` → put it in `server/.env` and on Render, redeploy
- [ ] Locally instead: `stripe listen --forward-to localhost:3000/webhooks/stripe` (Stripe CLI) prints a `whsec_…` for `.env`
- [ ] Stripe dashboard → Settings → Billing → Subscriptions and emails: Smart Retries on; « Send emails about failed card payments », « Send emails about upcoming renewals » and the trial-ending reminder on; after all retries fail → cancel the subscription
- [ ] Stripe dashboard → Settings → Branding and Business details (name, logo, support email) — shown on Checkout, the portal and invoices
- [ ] Stripe dashboard → Connect → Get started: platform in France, Express accounts, "the platform pays out" — then run `stripe:setup` (again) with `--webhook-url`: it also creates the Connect endpoint `…/webhooks/stripe/connect` and prints `STRIPE_CONNECT_WEBHOOK_SECRET=whsec_…` for `server/.env` and Render
- [ ] Locally: `stripe listen --forward-to localhost:3000/webhooks/stripe --forward-connect-to localhost:3000/webhooks/stripe/connect` prints the secret to use for both
- [ ] Booking payments use Stripe's own page, sent back through the website: `WEB_APP_URL` must be set on Render, and the website deployed with `/paiement/retour`. Nothing to add to the app: no Stripe key there

---

## End-to-end runs

- [ ] **Stylist**: sign up → 4 steps → pending → admin approves → shop completion → dashboard → create a service → salon appears in `/search`
- [ ] **Rejection**: admin rejects with a reason → mobile shows that reason → "Modifier mon dossier" → resubmit
- [ ] **Appointment**: client books → stylist accepts → client reschedules → stylist sees the block move → client cancels
- [ ] **Booking rules**: salon sets 1 h / 1 jour → client can't book a slot 45 min away → books tomorrow 10:00 → salon accepts → after 10:00 today "Modifier" / "Annuler" are gone
- [ ] **Closure**: stylist adds a closure over a booked slot → warned, booking kept → the client can't book anything else inside it
- [ ] **Review**: past appointment → review → stylist replies → report it (API) → admin hides it → gone from the public page
- [ ] **Subscription**: new coiffeur → admin validates → email « Choisir mon abonnement » → `/pro/abonnement` → Checkout with 4242 → salon listed, app shows « Essai gratuit »
- [ ] **Paid booking**: client pays 40 € at Studio W → salon accepts → the day after the appointment `/admin/paiements` shows it « Payé » (demo salon: no transfer); with a catalogue salon whose payouts are set up: « Versé au salon », 36 € in its Express dashboard, 4 € commission
- [ ] **Failed renewal** (Stripe test clock, or card `4000 0000 0000 0341` then end the trial from the dashboard): « Paiement refusé » banner in the app + push, salon still listed → after the retries Stripe cancels → salon gone from search, « Abonnement terminé » veil, email with the link → subscribe again → listed again
- [ ] **J-7**: a subscription cancelled in the portal with its end 7 days away → push + email « se termine le … » once

---

## Mocked — don't report as bugs

- **Payments**: Stripe **test mode** — test cards only, nothing is charged; test-mode transfers go to test Express accounts.
- **Subscriptions**: Stripe in **test mode** — test cards only, nothing is charged. Seeded salons run on an offered year (no Stripe) until they subscribe.
- **Push**: no `eas.projectId` in `app.json` → token registration fails silently. Every notification is created server-side (see `notifications_log`) but can't reach a phone until `eas init` is run with the WorldHair Expo account.
- **Emails**: sent via Resend + a Supabase "Send Email" hook. Only sends to real inboxes once `worldhair.app` is verified in Resend — until then, sending is limited to the Resend account's own registered address.
- **Render**: first request after idle takes 30–60s.

---

## Automated tests

| Command | Expected |
|---|---|
| `cd server && bun run test` | 439 ✅ (runs in UTC, like Render) |
| `cd server && bun run test:e2e` | 82 ✅ |
| `cd server && bun run check:rls` | "All checks passed" — the app's public key can't write around the API, nor list every booking (live dev database) |
| `cd mobile && bun run test` | 106 ✅ |
| `cd web && bun run test` | 40 ✅ |

`typecheck` + `lint` green on all three packages.
