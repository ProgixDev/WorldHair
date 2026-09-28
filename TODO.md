# WorldHair — TODO (completion plan)

Reference: the signed devis (client + coiffeur + admin interfaces, Stripe
subscriptions for coiffeurs), plus real prestation payment (issue #2). Audit of
2026-09-28: about 65 % done. This list only holds what is missing. What is
already built is in this file's git history and in TESTING.md. Store
publication is handled outside this list.

Each item is one complete slice: database, API, mobile app and web admin
together. Check an item only when every layer is done.

## Definition of done (every item)

- Schema change in `server/_variants/supabase/schema.sql`, applied to the dev
  Supabase project, and mirrored in `FakeSupabaseService` (grep every reader of
  a renamed column: services, DTOs, the fake, seed scripts).
- API: DTO validation, role guard, unit + e2e tests.
- App and web wired to the real API, with loading, error and empty states, in
  French.
- Seed scripts updated so the demo accounts show the feature.
- Checked live against the dev database, not only the fake-backed tests.
- `typecheck`, `lint` and `test` green in server, mobile and web. New manual
  checks added to TESTING.md.

## Phase 1 — Security and cleanup (do first)

- [x] **Lock direct database writes (critical)**
  - DB: revoke INSERT/UPDATE/DELETE from `anon` and `authenticated` on every
    public table, then grant back only `UPDATE (first_name, last_name,
    photo_url)` on `profiles`. Drop the client write policies on
    `appointments`, `reviews`, `coiffeur_subscriptions`, `coiffeur_profiles`,
    `coiffeur_services`, `coiffeur_availability`, `coiffeur_gallery_photos`,
    `push_tokens`, `notification_preferences` (the API already writes them
    with the service-role key). Keep the Storage upload policies.
  - App: delete `debugSetSubscriptionEnd` and `resetProWorkspace`
    (`services/pro.ts`), which write subscriptions directly.
  - Done when: with the anon key and a normal user's token, changing
    `profiles.role`, `account_status`, a review, a rating, a subscription or an
    appointment fails, and every app flow still works.
  - Done 2026-09-28: applied to the dev database, `bun run check:rls` passes.
    Tables created later start locked too (default privileges). Not done on
    purpose: revoking `anon` execute on `is_admin()` would break every
    anonymous read through a policy that calls it, and it only ever answers
    "false" to an anonymous caller. Leaked-password protection needs a paid
    Supabase plan: moved to Phase 8.
- [x] **Remove demo and debug UI from release builds**: the "Mode démo" bar on
      sign-in, the pro "Développement" group (Simuler J-7, Simuler expiré,
      Réinitialiser) and the particulier "Développement" group (Moteur de
      carte, Rejouer l'onboarding). Keep them behind `__DEV__` or delete them.
      Demo accounts live on the dev database only.
      Done: the demo bar and the particulier group are dev-build only; the pro
      group is deleted (it wrote subscriptions directly).
- [x] **Remove social login**: delete the Google and Apple buttons and the
      placeholder in `services/auth.ts`. Email and password only.
- [x] **Real slot grid (quick fix)**: delete `pseudoBusy()` in
      `mobile/src/features/salons/slots.ts`, and grey a slot when
      `[start, start + duration)` overlaps a busy booking, using the
      `durationMin` that `/appointments/salon/:id/busy` already returns.
      Phase 2 moves this calculation to the server.
      Done, and the lunch break is greyed too (the app used to drop it).
- [x] **Paris timezone on the server**: `assertSlotAvailable` reads weekday and
      minutes from the machine clock, and the admin stats buckets
      (`admin-stats.service.ts`) are in UTC. Compute both in `Europe/Paris`.
      Done in code (`src/common/utils/paris-time.ts`), so no `TZ` setting is
      needed on Render. Server tests now always run in UTC like Render.
      Confirm with a 9:00 booking once this code is deployed.
- [x] **Missing booking notifications**: push to the client when the coiffeur
      refuses (`decide` emits no event today) and when the salon cancels (the
      listener only notifies the coiffeur). Push to the coiffeur when the
      client reschedules (no event today). Tapping opens the appointment.
      Done server-side, with the date and time in each message. They reach a
      phone once the push item below is done.
- [ ] **Push on real phones**: add the Expo project id (`eas init`,
      `extra.eas.projectId`) so push tokens register, then check a received
      push on iOS and Android. Needs the WorldHair Expo account: the Expo CLI
      on the dev machine is logged into a different account.
- [x] **Real ratings**: compute `coiffeur_profiles.rating` and `review_count`
      from non-hidden reviews (trigger, or recompute on create and moderation).
      Search sort and salon cards use them.
      Done with a database trigger. Salons with no review show « Nouveau ».
      The catalogue seed now writes real reviews (3 to 6 per salon).
- [x] **Hide blocked salons**: `search_salons()` and `POST /appointments`
      exclude salons whose `profiles.account_status` is not `active`. The
      subscription and payout checks come in Phases 4 and 5.
      Done, and the salon page returns "not found" too.
- [x] **No cancelling the past**: `cancel` rejects appointments already done,
      so a coiffeur can't cancel afterwards and block the client's review.
      Done, plus: a past appointment can't be moved, and a request whose time
      has passed can't be accepted or refused.
- [x] Fix the server lint error: unused `_options` in
      `test/utils/fakes/fake-supabase.service.ts:407`.

## Phase 2 — Booking engine

Done 2026-09-28: code, tests and the dev database (migrations
`phase2_booking_engine` and `phase2_appointment_deadline_snapshot`). The app
needs the new server deployed; manual checks are in TESTING.md.

- [x] **Server-side slot calculation**, the single source of truth for the
      booking grid.
  - API: `GET /salons/:id/slots?date=YYYY-MM-DD&serviceIds=…` (later
    `&staffId=`) returns the bookable starts, using hours, break, time off,
    existing bookings, total duration and the salon's booking notice. `POST
    /appointments` and reschedule call the same function.
  - DB: exclusion constraint on (coiffeur, time range) for active bookings
    (`btree_gist`), so two simultaneous requests can't double-book.
  - App: the slot step reads this endpoint; the client-side logic in
    `slots.ts` goes away.
  - Done. The endpoint is `GET /appointments/salon/:id/slots?date=…&serviceIds=…`
    (`&appointmentId=…` when moving a booking). One set of rules
    (`server/src/appointments/booking-rules.ts`) serves the grid, booking,
    reschedule and move. The constraint is live: the second of two requests on
    the same slot gets "no longer available" and the grid reloads.
- [x] **Several prestations in one booking** (devis: total duration and price
      add up).
  - DB: `appointment_services` (appointment_id, service_id nullable, name,
    price and duration snapshots, position). `appointments.price` and
    `duration_min` become totals.
  - API: `POST /appointments` takes `serviceIds[]`; responses and notification
    texts list the services.
  - App: the service step becomes a multi-select with a running total. The
    ticket, "Mes rendez-vous", the coiffeur agenda and the dashboard's top
    services show every line.
  - Done when: 2 services give one continuous block of the summed duration,
    with the summed price on both sides.
  - Done. Notifications read "Coloration complète + Soin fondant". Bookings
    made before this show as a single line.
- [x] **Instant confirmation or manual approval, per salon**
  - DB: `coiffeur_profiles.confirmation_mode` (`manual` or `instant`, default
    `manual`).
  - API: in instant mode a paid request becomes `confirmed` directly and sends
    the confirmation push.
  - App: toggle in the pro salon settings. The client's confirmation screen
    says "Confirmé" or "En attente" accordingly.
  - Done: « Je valide » or « Confirmées d'office » in "Mon salon" →
    RÉSERVATION. The client's last screen reads "C'est réservé." or "Demande envoyée."
- [x] **Booking and cancellation deadlines, per salon**: the salon decides how
      late a client can book and how late they can cancel (for example book up
      to 1 hour before, cancel up to 1 day before).
  - DB: `coiffeur_profiles.booking_notice_minutes` (latest a client can book
    before the start, default 60) and `cancellation_notice_minutes` (latest a
    client can cancel or modify, 0 = anytime, default 1 440).
  - API: the slot engine hides slots that start inside the booking notice, and
    `POST /appointments` refuses them. Particulier cancel and reschedule are
    refused inside the cancellation notice, with a clear message; the new slot
    of a reschedule must also respect the booking notice. The coiffeur's own
    actions are not limited.
  - App, coiffeur: "Réservation" settings with presets for both deadlines (à
    tout moment, 30 min, 1 h, 2 h, 12 h, 1 jour, 2 jours).
  - App, client: the salon page and the booking recap show both rules with the
    refund rule from Phase 5 ("Réservable jusqu'à 1 h avant · Annulation
    jusqu'à 24 h avant"). "Modifier" and "Annuler" are disabled with an
    explanation once it's too late.
  - Done when: with 1 h and 1 day, a slot starting in 45 minutes is not
    offered, and a booking for tomorrow 10:00 can no longer be cancelled after
    10:00 today.
  - Done. The refund rule joins the text in Phase 5. Once too late,
    "Modifier" and "Annuler" are hidden rather than greyed, and the card says
    the salon's deadline has passed. A booking keeps the notice in force when
    it was made, so changing the setting only affects new bookings. Until it
    starts, the client can still change a request the salon hasn't accepted
    yet, or a time the salon imposed by moving the booking ("Horaire déplacé
    par le salon"). Nothing can be changed once it has started.
- [x] **Days off and exceptional closures (congés)**
  - DB: `coiffeur_time_off` (profile_id, staff_id nullable for Phase 3,
    starts_at, ends_at, label).
  - API: CRUD `/salon/me/time-off`. Slots and booking validation skip these
    periods. Bookings already inside a new closure are listed to the coiffeur,
    not cancelled automatically.
  - App: "Congés et fermetures" in the pro agenda (date range picker). The
    client's day strip shows the salon closed.
  - Done: whole days or a few hours of one day, from « Fermetures » in the
    agenda header. Closures are drawn in the day column. `staff_id` is there,
    unused, for Phase 3.
- [x] **Coiffeur moves an appointment** ("déplacer"): `PATCH
      /appointments/:id/move` (coiffeur only) with slot validation and a push
      to the client. "Déplacer" action on the agenda card, reusing the slot
      picker.
      Done for accepted appointments that haven't started (a pending request
      is accepted or refused). The salon's booking notice doesn't apply to the
      coiffeur.
- [x] **Mark attended or no-show** ("marquer comme honoré"):
      `appointments.attendance` (`attended`, `no_show` or empty), set by the
      coiffeur once the slot has passed. No review after a no-show. The
      dashboard shows a no-show rate; the client's history shows the outcome.
      Done: « Honoré » / « Absent » from the agenda's "LE CLIENT EST-IL
      VENU ?" list or the booking's sheet. The client's history flags a missed
      appointment; an attended one reads like any past appointment. « Absent »
      is refused once the client has left a review, so marking can't remove
      one: reporting the review is the way.
- [x] (optional) **Email reminder at J-1** when push is off (the mail module
      already exists). Done: sent when the client has no push token. A
      booking moved after its reminder gets one again for the new time.

## Phase 3 — Staff (collaborateurs)

On hold since 2026-09-28: Progix may drop it. It is in the devis (Espace
coiffeur, and the 50 % milestone), so dropping it needs the client's written
agreement (avenant). Nothing depends on it: salons work with one agenda.

- [ ] **Several staff members per salon, each with their own agenda and
      services** (devis, Espace coiffeur).
  - DB: `salon_staff` (id, salon profile_id, name, photo_url, active,
    position), `staff_services` (staff_id, service_id), `staff_availability`
    (staff_id, weekday, hours, break; defaults to the salon hours),
    `appointments.staff_id`, `coiffeur_time_off.staff_id`. The migration
    creates one staff row for the owner of every existing salon, so solo
    salons keep working.
  - API: CRUD `/salon/me/staff` (with services, hours and time off per
    person). Slots are computed per person. `POST /appointments` takes a
    `staffId` or "no preference" (first free person). The exclusion constraint
    applies per person instead of per salon.
  - App, coiffeur: "Équipe" screen (add, edit, deactivate, photo, services,
    hours). The agenda filters or splits by person; appointment cards show who.
  - App, client: optional "Avec qui ?" step ("Sans préférence" by default).
    The team is shown on the salon page.
  - Done when: two people in one salon can take overlapping bookings, and a
    service that only one person does only offers that person's slots.

## Phase 4 — Stripe subscriptions for coiffeurs

Phases 2 to 4 together complete devis phase 3, which unlocks the 50 % milestone
(Phase 3, staff, is on hold). Coiffeurs subscribe on the website; the app only
shows the status.

Done 2026-09-28 in code, tests and the dev database (migration
`phase4_stripe_subscriptions`). Decided: a card is required to start. The
salon stays hidden until the coiffeur subscribes on the website; the free
trial is Stripe's (length set in the admin), for a first subscription only,
and only once the admin has validated the salon. Not yet run against a real
Stripe account: that needs the keys (see TESTING.md, "Stripe").

- [x] **Stripe setup**: the client's Stripe account connected (API keys and
      webhook secret in the server env, test mode first), one product with a
      monthly and a yearly price. Prices are read from Stripe through the API,
      no longer hardcoded in the app (19 € / 182 € today).
      Done: `bun run stripe:setup` creates the product, both prices (found by
      lookup key, so no price id in the env), the Customer Portal settings,
      and with `--webhook-url` the webhook endpoint. The app shows no price
      at all; the website reads them from Stripe.
- [x] **Stripe billing backend**
  - DB: `coiffeur_subscriptions` gains `stripe_customer_id`,
    `stripe_subscription_id`, a `status` aligned on Stripe (`trialing`,
    `active`, `past_due`, `canceled`, `unpaid`), `current_period_end`,
    `cancel_at_period_end`, `trial_end`. New `platform_settings` table (trial
    days, later the commission rate).
  - API: `POST /subscriptions/checkout-session` (Stripe Checkout, monthly or
    yearly price, trial from the settings), `POST
    /subscriptions/portal-session` (Customer Portal: change plan, card, cancel,
    invoices), `POST /webhooks/stripe` (signature checked on the raw body;
    `rawBody` is already enabled in `main.ts`) handling
    `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`,
    `invoice.payment_failed`. Remove today's free change-plan, cancel and
    reactivate endpoints.
  - Check that the `stripe` package loads under Jest (CommonJS) before
    building on it.
  - Done when: a test-mode card makes the subscription active; a failed
    renewal shows the past-due banner, then cancels after the retries and
    delists the salon; subscribing again lists it again.
  - Done in code and tests. A scheduled cancellation is stored as `cancel_at`
    rather than a `cancel_at_period_end` flag, and `renews_at` became
    `current_period_end`. Each webhook fetches the subscription fresh from
    Stripe, one at a time per subscription, so late, repeated or racing
    events can't leave an old state; a Stripe subscription whose period is
    over by 3+ days without news stops listing the salon. Checkout asks
    Stripe itself before selling a second subscription and closes any other
    open Checkout page, so a coiffeur can't pay twice; a salon on an offered
    period keeps it whole (first charge at its end). No booking can be
    placed after a scheduled end. `GET /subscriptions/prices` feeds the
    website. The "done when" walk-through needs the Stripe keys.
- [x] **Subscription page on the website**: `web/src/app/(pro)/abonnement`. The
      coiffeur signs in, sees status and dates, subscribes, and manages
      everything through the Customer Portal (plan, card, cancellation,
      downloadable invoices).
      Done at `/pro/abonnement`. `/login` now takes coiffeurs too and sends
      each role to its space; subscription emails link to the page.
- [x] **App side, status only**: plan, status and dates read from the server.
      No purchase button and no payment link in the app. The J-7 banner and the
      expired veil (issue #8, already built) show the status; the renewal link
      goes out by email instead (J-7 and expiry reminders sent by the server).
      Done. The veil only covers an ended subscription: a new salon that never
      subscribed can still set up its page. Emails: account validated (with
      the link to subscribe), J-7 before a scheduled end, subscription ended.
      Pushes: payment refused, trial ending, J-7, ended — a tap opens the
      account tab.
- [x] **Listing depends on the subscription**: `search_salons()` and `POST
      /appointments` require `trialing` or `active` (`past_due` tolerated during
      retries).
      Done, and the salon page too. The 28 salons on the dev database got an
      offered year so nothing vanished; the seed scripts do the same.
- [x] **Payment failures** (devis: relance, suspension, résiliation,
      réactivation): Stripe Smart Retries and failed-payment emails turned on;
      banner in the app while `past_due`.
      Done in code (banner and push). Smart Retries and Stripe's own emails
      are switches in the Stripe dashboard: see TESTING.md, "Stripe".
- [x] **Admin**: `/admin/abonnements` shows the Stripe status, period end and a
      link to the Stripe customer. Trial days editable in `/admin/parametres`.
- [x] **Moderation stops billing** (added 2026-09-28): banning a coiffeur
      cancels their Stripe subscription at once; suspending pauses billing
      until the admin reactivates the account.

## Phase 5 — Prestation payment (issue #2, Stripe Connect)

Rules: the client pays the full price when sending the request. WorldHair
holds the money and pays the salon after the appointment, minus a commission
set in the admin. Full refund if the coiffeur refuses or cancels, or if the
client cancels before the salon's deadline. No refund after the deadline or
for a no-show.

Done 2026-09-28 in code, tests and the dev database (migration
`phase5_payments`). Decided on the way: salons without payouts stay listed
but can't be booked ("Réservation en ligne bientôt disponible"), except the
demo salon, which takes bookings without its own Stripe account (its money
waits with WorldHair, and would be paid out if it ever set up payouts); a
salon is paid 24 h after the appointment ends; a request the salon never
answers is cancelled and refunded at its start time; the commission starts
at 10 %. Not yet run against a real Stripe account: it needs the keys and
Connect switched on — see TESTING.md, "Stripe".

Reviewed the same day (migration `phase5_payment_hardening`), fixed: a
refund and the salon's payout never run at once on a payment, and a payout
whose answer was lost is found again on Stripe instead of being sent twice;
an admin refund after the payout takes back exactly the salon's share of it;
what was refunded is Stripe's own count, so a late or lost webhook changes
nothing; a refund Stripe can't make at the time (outage) no longer fails the
cancellation, a job makes it within 10 minutes; the payout job reads only
what is due, however many bookings pile up; a client holds one unpaid slot
at a time; a salon can't read an unpaid hold even straight from the
database; the expiry push only says "remboursé" when it was.

Then, per the owner (same day): the client pays on Stripe's own payment page
(Checkout) in the browser instead of a payment sheet inside the app — told
that Apple and Google take nothing on bookings either way (physical
services), the owner still preferred the web. The app no longer carries
Stripe's native SDK (migration `phase5_web_checkout`).

- [x] **Salons connect Stripe to get paid**
  - Stripe: enable Connect on the client's account (platform profile), Express
    accounts for salons.
  - DB: `coiffeur_payout_accounts` (profile_id, stripe_account_id,
    details_submitted, charges_enabled, payouts_enabled).
  - API: `POST /payments/connect/onboarding-link`, `GET
    /payments/connect/status`, webhook `account.updated`.
  - App, coiffeur: "Paiements" screen with the Stripe onboarding (opens in the
    browser), its status and a link to the Stripe Express dashboard. A salon
    appears in search only once onboarding is complete, like the mandatory
    shop setup.
  - Done: "Paiements" in the Compte tab, and a banner on the dashboard while
    online booking is off. The onboarding opens in the browser and comes back
    through the website's `/connect/retour` page. Per the owner, a salon
    without payouts stays in search with booking off; the demo salon is
    exempt (`bookable_without_payouts`). `account.updated` has its own
    Connect endpoint, `/webhooks/stripe/connect`.
- [x] **Client pays when sending the request**
  - DB: `payments` (appointment_id, payment_intent_id, amount, commission rate
    and amount snapshots, status, refunded_amount, transfer_id,
    transferred_at). New appointment status `awaiting_payment`, which holds the
    slot for a few minutes.
  - API: `POST /appointments` creates the held appointment and a
    PaymentIntent for the services total, and returns the client secret.
    Webhook `payment_intent.succeeded` sends the request to the coiffeur
    (`pending`, or `confirmed` in instant mode) with the notifications. A
    failed or abandoned payment releases the slot (scheduled job).
  - App: Stripe PaymentSheet (`@stripe/stripe-react-native`, added with
    `expo install`) replaces the simulated "•••• 4242" step and
    `payForAppointment`. Apple Pay and Google Pay if enabled. Stripe emails
    the receipt.
  - Done when: a test card pays and only then does the coiffeur see the
    request; a declined card leaves no request and frees the slot.
  - Done: « Payer » opens Stripe's payment page in the browser (cards;
    Stripe shows Apple Pay / Google Pay there when the phone has them), and
    the website's `/paiement/retour` hands back to the app, which asks the
    server. The slot is held 15 minutes; releasing it closes Stripe's page
    (Stripe keeps one open 30 minutes). Leaving the payment step frees it at
    once, and a job frees unpaid holds every minute. A payment landing after
    its hold was freed is refunded automatically.
- [x] **Refunds**: automatic full refund when the coiffeur refuses or cancels,
      or when the client cancels before the salon's deadline. None after the
      deadline or for a no-show. The coiffeur can still refund by hand, fully or
      partly, from the appointment. The client sees the refund in "Mes
      rendez-vous" and gets a push.
      Done, plus: a request the salon never answered is cancelled and fully
      refunded at its start time, with its own push. A refund Stripe can't
      make at the time is made again every 10 minutes until it goes through.
- [x] **Paying the salon after the appointment**: a scheduled job transfers the
      amount minus the commission to the salon's Stripe account once the
      appointment has passed (separate charges and transfers, `transfer_group`
      = appointment id). Refunded bookings are not transferred.
      Done: hourly, 24 h after the end, tied to the client's charge
      (`source_transaction`); the commission is taken on what the client kept.
- [x] **Commission**: rate in `platform_settings`, editable in
      `/admin/parametres`, copied onto each payment. Stripe's card fees are
      taken from WorldHair's side, so the rate should cover them.
      Done; starts at 10 %.
- [x] **Coiffeur payments view**: amount paid, commission, transfer and refund
      per appointment in the pro area. Dashboard revenue counts paid bookings.
      Done: the Paiements screen lists each paid booking; the booking's sheet
      shows it and refunds; revenue counts what clients kept.
- [x] **Admin payments page** `/admin/paiements`: payments, refunds, transfers,
      commission totals, and an admin refund for disputes.
      Done; an admin refund after the payout takes the salon's share back first.
- [x] Payment webhooks share the Phase 4 endpoint: `payment_intent.*`,
      `charge.refunded`, `account.updated`, `transfer.*`.
      Done: `payment_intent.succeeded` and `charge.refunded` there;
      `account.updated` comes on the Connect endpoint (Stripe sends connected
      accounts' events apart). No `transfer.*` needed: a transfer is recorded
      when it's made.

## Phase 6 — Discovery, salon page and profile

- [ ] **Search filtering on the server**: `fetchSalons` downloads at most 100
      salons and filters them on the phone, so salon 101 and beyond silently
      disappear. Move filters and sorts into `search_salons()` / `GET /salons`
      with pagination; the map asks for the visible area.
- [ ] **Missing filters** (devis, filtres utiles): price range, opening hours
      (open now, a given day, after a given time), salon or home service (copy
      `practice_zone` and the travel radius from the application into
      `coiffeur_profiles`, in `CoiffeurProfileSeedListener`).
- [ ] **Sort by availability** (devis: tri par distance, note et
      disponibilité): next free slot per salon from the Phase 2 engine, shown
      on the cards ("Dispo aujourd'hui 14:30").
- [ ] **Favorites**: `favorites` table (particulier_id, coiffeur_id), `GET`,
      `POST` and `DELETE /favorites`, a heart on salon cards and the salon
      page, a "Favoris" list in the profile tab.
- [ ] **Social links** on the salon page: Instagram, Facebook, TikTok and
      website columns on `coiffeur_profiles` (validated URLs), pro edit form,
      icons on the public page.
- [ ] **Hide a service** (devis: prestation active ou masquée):
      `coiffeur_services.is_active`. Hidden services are excluded from the
      public page, from `price_from` and from booking. Toggle in the service
      editor.
- [ ] **"Signaler" on reviews**: a button on each review on the salon page
      (client) and in `/pro/reviews` (coiffeur), with a reason picker, calling
      the existing `POST /reviews/:id/report`. One report per user per review.
- [ ] **Complete coiffeur stats** (devis: réservations, taux de remplissage,
      CA, avis reçus): add reviews received (count and average) and the weekly
      fill rate to the dashboard.

## Phase 7 — Back-office completion

- [ ] **Rendez-vous page** `/admin/rendez-vous`: list and filters (status,
      salon, dates, client), detail with payment status, admin cancellation
      with a reason that notifies both sides and refunds, for disputes (devis:
      traitement des litiges). API `GET /admin/appointments`, `PATCH
      /admin/appointments/:id/cancel`.
- [ ] **Reported reviews**: show the reason and the reporter; keep hide and
      restore.
- [ ] **Platform settings**: trial days and commission rate in
      `/admin/parametres`.

## Phase 8 — GDPR, legal texts and production setup

- [ ] **Write our legal texts**: CGU (including payment, refund and commission
      rules), privacy policy (geolocation, identity documents, payments,
      retention) and legal notice, with the client's company details (name,
      address, SIRET, publication director, host).
- [ ] **Legal pages**: `/cgu`, `/confidentialite` and `/mentions-legales` on the
      site. The sign-up checkbox links open them; links in the app profile and
      the site footer. Store `terms_accepted_at` and the terms version.
- [ ] **Delete my account** in the app (GDPR, and required by Apple):
      `DELETE /users/me` removes the auth user, the profile cascade and the
      stored files; reviews are anonymized. Upcoming paid bookings are
      cancelled and refunded. For a coiffeur, clients are notified, the
      subscription is cancelled and pending transfers are settled.
- [ ] **Export my data** (GDPR access right): `GET /users/me/export` (profile,
      appointments, payments, reviews), shared from the app.
- [ ] (optional) **Retention**: purge the documents of rejected or deleted
      coiffeurs after N days (scheduled job).
- [ ] **Production environment**: a new Supabase project on a paid plan (daily
      backups, no pausing) with the schema applied and only the admin seeded
      (no demo, no catalogue); the current project stays as staging. Render
      paid instance (no sleep) with `TZ=Europe/Paris` and a custom domain.
      Stripe live keys, live webhook endpoint and live Connect — on the new
      project only: the dev database's subscriptions hold test-mode Stripe
      ids that live keys can't read. Leaked-password
      protection turned on in Supabase Auth (paid plans only). Error tracking
      (Sentry or similar) on server, app and web. A strong admin password
      instead of `admin123`, a strong Android keystore password, backups of the
      keystore and secrets.
- [ ] **Lists past 1 000 bookings**: PostgREST returns 1 000 rows at most, so
      the coiffeur's agenda and dashboard and the client's history silently
      drop bookings once there are more. Page them, or load a window (upcoming
      plus recent months) and compute the dashboard stats in SQL. The booking
      engine already reads only the bookings that can still collide.
- [ ] **Email**: verify the sending domain in Resend (SPF and DKIM DNS
      records), set `MAIL_FROM` on that domain, point the Supabase auth email
      hook at production. Done when a new user with an outside address
      receives the 6-digit code.

## Phase 9 — QA, documentation and handover

- [ ] **Full manual test pass**: the 29 unchecked cases in TESTING.md (mostly
      the admin pages and the 5 end-to-end runs), plus every new feature, on
      real iOS and Android phones. Payment runs with Stripe test cards:
      success, decline, refusal refund, late cancel, no-show, transfer.
- [ ] **Automated tests** for every new module (server unit and e2e, mobile
      logic tests), including webhook handlers with fixture events.
- [ ] **Technical documentation**: architecture, API reference (OpenAPI with
      `@nestjs/swagger`), database schema, Stripe subscriptions and Connect
      payment flows, deployment and runbook (environment variables, backup and
      restore, key rotation).
- [ ] **Back-office user guide** (salon validation, moderation, appointments
      and disputes, payments and refunds, subscriptions, ads, content) and a
      training session.
- [ ] **Site**: `/particuliers` and `/coiffeurs` pages, basic SEO (metadata,
      sitemap, robots).
- [ ] **Handover**: accounts, access and credentials transferred to the client
      (devis section 05: full ownership once fully paid).

## After launch (in the devis, not development)

- 90-day marketing: salon recruitment, ad creatives, Meta, Google and Apple
  Search Ads campaigns, reporting.
- 90-day support: bug fixes and minor adjustments.

## Out of scope

- Annual event with trophies, equipment resale (excluded in the devis).
- Admin and coiffeur messaging (built, then removed).
