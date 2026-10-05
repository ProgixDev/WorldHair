-- Supabase schema for the "supabase" server variant.
--
-- Run this once against your Supabase project (SQL Editor, or `supabase db
-- push` / `psql` with the CLI) after `bun run setup:supabase`. It is NOT
-- applied automatically — there's no live project to apply it to at setup
-- time.
--
-- This is the standard "profiles table" pattern from Supabase's own docs
-- (https://supabase.com/docs/guides/auth/managing-user-data): a `profiles`
-- row per `auth.users` row, kept in sync by a trigger, with Row Level
-- Security restricting each user to their own row.

-- `first_name`/`last_name`/`photo_url` are the particulier profile fields
-- from the mobile app's `ParticulierProfile` (see
-- mobile/src/services/auth.ts) — there's no username/handle concept
-- anywhere in this product, so this departs from the generic starter
-- template's username-based `profiles` shape rather than keeping unused
-- columns alongside real ones. A coiffeur account leaves these at their
-- defaults; their identity lives in `coiffeur_applications` instead (below).
-- `role` starts 'particulier' for everyone; submitting a coiffeur
-- application (below) is what flips it to 'coiffeur' — see
-- src/coiffeur/coiffeur-applications.service.ts. There is no 'admin' signup
-- path: promote a user by hand (`update public.profiles set role = 'admin'
-- where id = '<uuid>'`) since the back-office that would do this doesn't
-- exist yet (TODO.md → Back-office admin).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  photo_url text,
  -- 'admin_limited' (TODO.md/web "Paramètres" → create-admin section): every
  -- admin capability except creating more admins — see is_admin() below and
  -- server/src/admin-users/.
  -- 'staff' (TODO.md Phase 3): a coiffeur who works in someone else's salon,
  -- joined with the owner's code — see salon_staff below and server/src/staff/.
  role text not null default 'particulier' check (role in ('particulier', 'coiffeur', 'staff', 'admin', 'admin_limited')),
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'banned')),
  -- The CGU and privacy policy this user accepted (TODO.md Phase 8): at
  -- sign-up (handle_new_user, from the app's sign-up metadata), then again
  -- through the API whenever their version changes (server/src/users/terms.ts).
  terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- auth.uid() wrapped in (select ...) so Postgres evaluates it once per
-- query instead of once per row — see
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
create policy "Users can view their own profile"
  on public.profiles for select
  using ((select auth.uid ()) = id);

-- Only first_name/last_name/photo_url are writable this way — the column
-- grant at the end of this file keeps `role` and `account_status` out of a
-- user's reach (they're read by the API to grant admin rights and enforce bans).
create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid ()) = id)
  with check ((select auth.uid ()) = id);

-- The server itself talks to Postgres with the SERVICE ROLE key
-- (see src/database/supabase.service.ts), which bypasses RLS entirely — the
-- policies above are what protect this table if it's ever queried with a
-- user's own (anon-key) session instead, e.g. directly from the client.

-- Auto-create an empty profile row whenever a new auth user signs up, so
-- `GET /users/me` always has a row to find (see src/users/users.service.ts).
-- Only ever invoked by the trigger below, never directly — EXECUTE is
-- revoked from PUBLIC so it can't be called as a PostgREST RPC endpoint
-- despite being SECURITY DEFINER.
-- The sign-up form's « J'accepte les CGU » box sends the version accepted
-- (mobile/src/features/legal/terms.ts): recorded with the time, as the
-- database sees it.
create function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted text := left(nullif(btrim(new.raw_user_meta_data ->> 'terms_version'), ''), 20);
begin
  insert into public.profiles (id, terms_accepted_at, terms_version)
  values (new.id, case when accepted is not null then now() end, accepted);
  return new;
end;
$$;

revoke execute on function public.handle_new_user () from public;

create trigger on_auth_user_created
after insert on auth.users for each row
execute procedure public.handle_new_user ();

-- Keep updated_at current on every profile edit. Same PUBLIC-execute
-- revocation as handle_new_user, for the same reason.
create function public.set_updated_at ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at () from public;

create trigger set_profiles_updated_at
before update on public.profiles for each row
execute procedure public.set_updated_at ();

-- Shared "is the caller an admin" check for any RLS policy that needs it
-- (storage.objects policies below, and any future one) — SECURITY DEFINER so
-- it doesn't depend on the calling role's own grant on public.profiles.
create or replace function public.is_admin ()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid () and role in ('admin', 'admin_limited')
  );
$$;

revoke all on function public.is_admin () from public;
grant execute on function public.is_admin () to authenticated, anon;

-- ── Coiffeur onboarding (TODO.md → Backend → "Auth & comptes") ──────────────
--
-- One row per coiffeur, covering their whole onboarding lifecycle: the
-- application itself, the admin's decision, and the mandatory post-approval
-- shop-profile completion (issue #7). Mirrors the mobile app's mocked
-- `ProApplication`/`Session.shopProfileComplete` (see
-- mobile/src/services/auth.ts) now that there's a real backend for it.
--
-- Document columns are Storage object paths, not file data — the mobile
-- client uploads straight to the `coiffeur-documents` bucket below with its
-- own (anon-key) session, then only sends this table the resulting paths.
-- This server never receives or stores the files themselves.
create table public.coiffeur_applications (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  salon_name text not null,
  description text not null default '',
  practice_zone text not null check (practice_zone in ('salon', 'domicile')),
  -- Only set when practice_zone = 'salon'.
  address_line text,
  postal_code text,
  city text,
  invoice_document_path text,
  -- Only set when practice_zone = 'domicile'.
  travel_radius_km integer,
  identity_document_path text not null,
  diploma_document_path text not null,
  kbis_document_path text not null,
  status text not null default 'pending' check (status in ('pending', 'validated', 'rejected')),
  -- Shown to the coiffeur on a rejection; cleared on resubmission.
  review_message text,
  -- Issue #7: false again on every new approval, true once the mandatory
  -- shop-profile screen is completed. Irrelevant while status != 'validated'.
  shop_profile_complete boolean not null default false,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  -- Set when a rejected coiffeur's documents were deleted from storage, 90
  -- days after the rejection (TODO.md Phase 8, DocumentRetentionJob). A new
  -- submission, with its new uploads, clears it.
  documents_purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_zone_fields check (
    (practice_zone = 'salon' and address_line is not null and postal_code is not null and city is not null)
    or
    (practice_zone = 'domicile' and travel_radius_km is not null)
  )
);

alter table public.coiffeur_applications enable row level security;

-- As with `profiles` above: this server always queries with the service-role
-- key (bypassing RLS), so these policies only matter if this table is ever
-- queried directly with a user's own session instead.
-- One combined policy, not two: Postgres evaluates every permissive policy
-- that applies to a query, so an owner-only policy plus an admin-only policy
-- costs twice what one owner-or-admin policy does.
create policy "Coiffeurs can view their own application, admins can view every application"
  on public.coiffeur_applications for select
  using (
    (select auth.uid ()) = profile_id
    or public.is_admin ()
  );

create trigger set_coiffeur_applications_updated_at
before update on public.coiffeur_applications for each row
execute procedure public.set_updated_at ();

-- ── Coiffeur document storage ────────────────────────────────────────────────
--
-- Private bucket: identity documents, diplomas, KBIS/RNE extracts and premises
-- invoices are never public. Objects live at `{auth.uid()}/<kind>.<ext>` — the
-- storage policies below are the actual enforcement for uploads (not just
-- defense-in-depth like the table policies above), since the mobile client
-- uploads directly to Storage with its own session rather than through this
-- API. See server/src/coiffeur/coiffeur-applications.service.ts for how a
-- submitted path's `{uid}/` prefix is re-checked server-side too.
insert into storage.buckets (id, name, public)
values ('coiffeur-documents', 'coiffeur-documents', false);

create policy "Coiffeurs can upload their own documents"
  on storage.objects for insert
  with check (
    bucket_id = 'coiffeur-documents'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

-- Without this, only the FIRST upload of a given `kind` succeeds (a plain
-- insert). Any re-upload to that same `{uid}/<kind>.<ext>` path — which the
-- client always does via `upsert: true` (UploadSlot.tsx) — is an update
-- under the hood, and is silently denied by RLS without this policy. Same
-- gotcha already documented and fixed for `user-photos` below.
create policy "Coiffeurs can replace their own documents"
  on storage.objects for update
  using (
    bucket_id = 'coiffeur-documents'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

create policy "Coiffeurs can view their own documents"
  on storage.objects for select
  using (
    bucket_id = 'coiffeur-documents'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

create policy "Admins can view every coiffeur document"
  on storage.objects for select
  using (
    bucket_id = 'coiffeur-documents'
    and public.is_admin ()
  );

-- ── Coiffeur workspace (TODO.md → Backend → "Profils") ──────────────────────
--
-- The coiffeur's ongoing "Mon salon" page, prestations and weekly hours —
-- distinct from `coiffeur_applications` above, which is the one-time
-- onboarding snapshot. Mirrors mobile's ProProfile/ProService/AvailabilityDay
-- (see mobile/src/features/pro/types.ts) now that there's a real backend.
--
-- All these tables are readable by anyone (`using (true)`) — search and the
-- public salon page show them. Writes go through the API only
-- (src/salon/, service-role key): there are no client write policies, and
-- the grants at the end of this file revoke client writes altogether.
-- PostGIS powers real radius search (ST_DWithin/ST_Distance on a geography
-- point) for search_salons() below, instead of hand-rolled Haversine SQL.
create extension if not exists postgis with schema extensions;
-- Search matches words with or without accents ("élégance" = "elegance").
create extension if not exists unaccent with schema extensions;

create table public.coiffeur_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  salon_name text not null default '',
  tagline text not null default '',
  description text not null default '',
  address_line text not null default '',
  postal_code text not null default '',
  city text not null default '',
  phone text not null default '',
  -- The country the coiffeur picked for `phone` (ISO 3166-1 alpha-2). Not
  -- derivable from the E.164 number alone: a calling code can be shared
  -- (+1 covers ~25 countries), and for an unassigned range the phone
  -- library can't narrow it down at all. Null for rows that predate it —
  -- the app infers from the number then.
  phone_country text check (phone_country ~ '^[A-Z]{2}$'),
  specialties text[] not null default '{}',
  cover_url text,
  -- Nullable: a coiffeur's location is only known once they (or a seed
  -- script) set it — see UpdateSalonProfileDto. `location` is generated so it
  -- can never drift from latitude/longitude.
  latitude double precision,
  longitude double precision,
  location extensions.geography(Point, 4326) generated always as (
    case
      when latitude is not null and longitude is not null
      then extensions.ST_SetSRID(extensions.ST_MakePoint(longitude, latitude), 4326)::extensions.geography
      else null
    end
  ) stored,
  -- System-computed display fields — deliberately NOT part of
  -- UpdateSalonProfileDto. rating/review_count are kept in sync with the
  -- salon's non-hidden reviews by refresh_salon_rating() (see reviews
  -- below); badges are editorial.
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  badges text[] not null default '{}',
  -- Booking rules the coiffeur sets in "Mon salon" (UpdateSalonProfileDto):
  -- `instant` confirms a new booking straight away, `manual` waits for the
  -- coiffeur to accept it. The two notices say how late before its start a
  -- client can still book, and still cancel or move an accepted booking
  -- (0 = no limit). src/appointments/booking-rules.ts applies them.
  confirmation_mode text not null default 'manual' check (confirmation_mode in ('manual', 'instant')),
  booking_notice_minutes integer not null default 60 check (booking_notice_minutes between 0 and 20160),
  cancellation_notice_minutes integer not null default 1440 check (cancellation_notice_minutes between 0 and 20160),
  -- How the coiffeur works, copied from their application when it's
  -- validated (CoiffeurProfileSeedListener): in a salon, or at the client's
  -- home within travel_radius_km. Search filters on it (TODO.md Phase 6).
  practice_zone text not null default 'salon' check (practice_zone in ('salon', 'domicile')),
  travel_radius_km integer check (travel_radius_km between 1 and 100),
  -- The salon's pages elsewhere, icons on its public page
  -- (UpdateSalonProfileDto checks each points to its own site).
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coiffeur_profiles_specialties_valid check (
    specialties <@ array['coupe', 'coloration', 'afro', 'tresses', 'barbier', 'soins', 'mariage']::text[]
  )
);

create index coiffeur_profiles_location_idx
  on public.coiffeur_profiles using gist (location)
  where location is not null;

alter table public.coiffeur_profiles enable row level security;

create policy "Anyone can view a salon profile"
  on public.coiffeur_profiles for select
  using (true);

create trigger set_coiffeur_profiles_updated_at
before update on public.coiffeur_profiles for each row
execute procedure public.set_updated_at ();

-- One row per weekday (0 = Sunday, matching JS Date#getDay, same as mobile's
-- OpeningDay/AvailabilityDay). Lazily seeded (all closed) on first read by
-- src/salon/salon.service.ts rather than via a trigger — there's no clean
-- DB-level hook for "a coiffeur's application just got validated".
create table public.coiffeur_availability (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default false,
  opens_minute smallint not null default 540,
  closes_minute smallint not null default 1140,
  break_start_minute smallint,
  break_end_minute smallint,
  primary key (profile_id, weekday)
);

alter table public.coiffeur_availability enable row level security;

create policy "Anyone can view availability"
  on public.coiffeur_availability for select
  using (true);

-- A salon's team (TODO.md Phase 3): its owner (profile_id = salon_id) and
-- the coiffeurs who joined with one of his codes, each with their own
-- account (role 'staff'). One salon per person. A booking holds one of
-- them (appointments.staff_id). The owner's row is created on first use by
-- server/src/staff/staff.service.ts, and for every salon by the migration.
-- API only: RLS on, no policy.
create table public.salon_staff (
  id uuid primary key default gen_random_uuid (),
  salon_id uuid not null references public.profiles (id) on delete cascade,
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  -- Off: clients' bookings never land on this person (an owner who only
  -- manages); the owner can still give them one.
  takes_bookings boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index salon_staff_salon_id_idx on public.salon_staff (salon_id);

alter table public.salon_staff enable row level security;

-- A person's own week, inside the salon's hours (a booking fits both). No
-- rows: they work the salon's hours. Same shape as coiffeur_availability.
create table public.staff_availability (
  staff_id uuid not null references public.salon_staff (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_open boolean not null default false,
  opens_minute smallint not null default 540,
  closes_minute smallint not null default 1140,
  break_start_minute smallint,
  break_end_minute smallint,
  primary key (staff_id, weekday)
);

alter table public.staff_availability enable row level security;

-- « Rejoindre un salon »: a code the owner sends, one use, a few days.
create table public.salon_invites (
  code text primary key,
  salon_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index salon_invites_salon_id_idx on public.salon_invites (salon_id);

alter table public.salon_invites enable row level security;

create table public.coiffeur_services (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price > 0),
  duration_min integer not null check (duration_min > 0),
  specialty text not null check (
    specialty in ('coupe', 'coloration', 'afro', 'tresses', 'barbier', 'soins', 'mariage')
  ),
  -- A hidden prestation (TODO.md Phase 6) stays in the coiffeur's list, off
  -- the public page, the starting price and booking.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coiffeur_services enable row level security;

create policy "Anyone can view services"
  on public.coiffeur_services for select
  using (true);

create trigger set_coiffeur_services_updated_at
before update on public.coiffeur_services for each row
execute procedure public.set_updated_at ();

-- Every write goes through WHERE profile_id = ..., so this index earns its
-- keep despite the linter flagging it as unused on a brand-new, empty table.
create index coiffeur_services_profile_id_idx on public.coiffeur_services (profile_id);

-- "Réalisations" work-photo gallery on the public salon page — a handful of
-- photos the coiffeur curates themselves, distinct from the single cover
-- photo on coiffeur_profiles. Storage lives in the existing public
-- `user-photos` bucket at `{uid}/gallery/<file>` — its policies below only
-- key off the FIRST path segment (auth.uid()), so the extra `gallery/`
-- subfolder needs no new bucket or policy. This table is just the ordered,
-- deletable index of what's been uploaded there; rows are never updated,
-- only inserted or deleted (see src/salon/salon.service.ts).
create table public.coiffeur_gallery_photos (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  url text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.coiffeur_gallery_photos enable row level security;

create policy "Anyone can view gallery photos"
  on public.coiffeur_gallery_photos for select
  using (true);

create index coiffeur_gallery_photos_profile_id_idx on public.coiffeur_gallery_photos (profile_id);

-- Congés and exceptional closures: whole days (midnight to midnight, Paris)
-- or a few hours of one day — both are just a time range. Nothing can be
-- booked inside one. Adding one doesn't cancel bookings already inside it:
-- the API hands them back to the coiffeur (SalonService.addTimeOff).
-- `staff_id`: one person's congé (TODO.md Phase 3); null = the whole salon.
-- API only (the public salon page gets the times, never the label), so RLS
-- is on with no policy.
create table public.coiffeur_time_off (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  staff_id uuid references public.salon_staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  constraint coiffeur_time_off_ends_after_start check (ends_at > starts_at)
);

create index coiffeur_time_off_profile_id_ends_at_idx on public.coiffeur_time_off (profile_id, ends_at);
create index coiffeur_time_off_staff_id_idx on public.coiffeur_time_off (staff_id);

alter table public.coiffeur_time_off enable row level security;

-- "Rendez-vous / Agenda" (TODO.md). One row per booking, spanning its whole
-- lifecycle (pending -> confirmed/refused, confirmed -> cancelled). "done" is
-- NOT a stored status — the API derives it (confirmed + already past) at
-- read time, so there's no cron/background job needed to transition it.
create table public.appointments (
  id uuid primary key default gen_random_uuid (),
  -- Null once that side deleted their account (TODO.md Phase 8): the booking
  -- stays, anonymized — the other side's history, the salon's revenue and
  -- WorldHair's accounting (10 years) don't change. Every booking still to
  -- come was cancelled and refunded first (AccountDeletionService).
  particulier_id uuid references public.profiles (id) on delete set null,
  coiffeur_id uuid references public.profiles (id) on delete set null,
  -- Who in the salon's team does it (TODO.md Phase 3): held when the client
  -- books, chosen by the owner when he accepts. Null once that person left
  -- (only ever for a booking already past: leaving needs none to come).
  staff_id uuid references public.salon_staff (id) on delete set null,
  -- Nullable + a snapshot alongside: a coiffeur editing/deleting a service
  -- later must never retroactively change what a past booking says it was.
  service_id uuid references public.coiffeur_services (id) on delete set null,
  service_name text not null,
  price numeric(10, 2) not null check (price > 0),
  duration_min integer not null check (duration_min > 0),
  starts_at timestamptz not null,
  -- 'awaiting_payment': held for the client while they pay (TODO.md Phase 5),
  -- a few minutes at most — released if they don't. Only then does it
  -- become a request ('pending') or, for an instant-confirmation salon,
  -- 'confirmed'.
  status text not null default 'pending' check (
    status in ('awaiting_payment', 'pending', 'confirmed', 'refused', 'cancelled')
  ),
  client_note text,
  -- Set by the coiffeur once an accepted appointment has started ("marquer
  -- comme honoré"); null until then. No review after a no-show.
  attendance text check (attendance in ('attended', 'no_show')),
  -- The salon's cancellation notice when the client booked: changing the
  -- setting later never moves an existing booking's deadline. Null on
  -- bookings made before it was kept (the salon's current notice applies).
  cancellation_notice_minutes integer check (cancellation_notice_minutes >= 0),
  -- The salon moved it ("déplacer"): the client never chose that time, so
  -- they may cancel or change it until it starts, whatever the notice.
  moved_by_salon boolean not null default false,
  -- Who cancelled it: its client, its salon, WorldHair settling a dispute
  -- (admin → Rendez-vous), or the job expiring a request the salon never
  -- answered. Null unless cancelled, and on bookings cancelled before it
  -- was kept.
  cancelled_by text check (cancelled_by in ('client', 'salon', 'admin', 'system')),
  -- An admin's cancellation only: why, as both sides were told.
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_coiffeur_id_starts_at_idx on public.appointments (coiffeur_id, starts_at);
create index appointments_staff_id_starts_at_idx on public.appointments (staff_id, starts_at);
-- The admins' list: every salon's bookings, the latest first.
create index appointments_starts_at_idx on public.appointments (starts_at);
create index appointments_particulier_id_idx on public.appointments (particulier_id);
create index appointments_service_id_idx on public.appointments (service_id);

alter table public.appointments enable row level security;

-- One combined SELECT policy, not two: a separate policy per side would
-- both be permissive on the same action, which Postgres evaluates twice
-- per read for no benefit (same fix as coiffeur_applications' policy).
-- A slot held while its client pays reaches the salon only once paid, here
-- as in the API. No write policies: booking, moving, cancelling and
-- deciding all go through the API, which checks hours, overlaps and who may
-- do what.
create policy "Participant can view their own appointment"
  on public.appointments for select
  using (
    (select auth.uid ()) = particulier_id
    or ((select auth.uid ()) = coiffeur_id and status <> 'awaiting_payment')
  );

create trigger set_appointments_updated_at
before update on public.appointments for each row
execute procedure public.set_updated_at ();

-- No double booking, even when two requests for the same time arrive at
-- once: both can pass the API's own overlap check, only one gets in here
-- (the API turns the refusal, SQLSTATE 23P01, into "no longer available").
-- `timestamptz + interval` is only STABLE in general (days and months
-- depend on the timezone), which an index expression can't use; adding
-- minutes doesn't, so this wrapper is honestly IMMUTABLE.
create extension if not exists btree_gist with schema extensions;

create function public.appointment_time_range (starts_at timestamptz, duration_min integer)
returns tstzrange
language sql
immutable
parallel safe
set search_path = ''
as $$
  select tstzrange(starts_at, starts_at + make_interval(mins => duration_min))
$$;

-- One booking at a time per person (TODO.md Phase 3): two people of a salon
-- can take the same time, one person can't.
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (staff_id with =, public.appointment_time_range (starts_at, duration_min) with &&)
  where (status in ('awaiting_payment', 'pending', 'confirmed'));

-- The prestations of a booking, in order — several can be booked back to
-- back as one appointment, whose own service_name/price/duration_min hold
-- the joined names and the totals. Snapshots, like the appointment's own:
-- editing or deleting a service later never changes what was booked.
-- Bookings made before this table existed have no lines; the API falls back
-- to the appointment's own snapshot as their single line. API only.
create table public.appointment_services (
  id uuid primary key default gen_random_uuid (),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid references public.coiffeur_services (id) on delete set null,
  service_name text not null,
  price numeric(10, 2) not null check (price > 0),
  duration_min integer not null check (duration_min > 0),
  position smallint not null default 0
);

create index appointment_services_appointment_id_idx on public.appointment_services (appointment_id);
create index appointment_services_service_id_idx on public.appointment_services (service_id);

alter table public.appointment_services enable row level security;

-- Where a salon gets paid (TODO.md Phase 5): its Stripe Connect Express
-- account, and what Stripe says of it (account.updated). A salon takes
-- online bookings once payouts are enabled — or, for the demo salon only,
-- with bookable_without_payouts (seed:demo), so paying can be tried without
-- the salon's own onboarding; its money then stays with WorldHair. API only.
create table public.coiffeur_payout_accounts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_account_id text unique,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  bookable_without_payouts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coiffeur_payout_accounts enable row level security;

create trigger set_coiffeur_payout_accounts_updated_at
before update on public.coiffeur_payout_accounts for each row
execute procedure public.set_updated_at ();

-- The client's payment for an appointment (TODO.md Phase 5): WorldHair
-- charges the full price when the request is sent — on Stripe's payment page
-- (Checkout), opened by the app in the browser; its PaymentIntent is known
-- once the client paid — holds it, and transfers the price minus the commission to the salon a
-- day after the appointment. The commission rate is copied from
-- platform_settings when the client pays; the amount kept is settled at
-- transfer time, after any refund. A refund and the salon's transfer never
-- run at once on a payment: each holds locked_until (a lease that runs out
-- by itself) while it talks to Stripe. API only.
create table public.payments (
  id uuid primary key default gen_random_uuid (),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  -- Null once that side deleted their account, like the appointment's.
  particulier_id uuid references public.profiles (id) on delete set null,
  coiffeur_id uuid references public.profiles (id) on delete set null,
  payment_intent_id text unique,
  checkout_session_id text unique,
  charge_id text,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'eur',
  commission_rate numeric(5, 2) not null check (commission_rate between 0 and 100),
  commission_amount numeric(10, 2) not null check (commission_amount >= 0),
  status text not null default 'requires_payment' check (
    status in ('requires_payment', 'succeeded', 'canceled')
  ),
  refunded_amount numeric(10, 2) not null default 0 check (refunded_amount >= 0),
  transfer_id text unique,
  transfer_amount numeric(10, 2),
  transferred_at timestamptz,
  -- Set before each try at the transfer: from the first one on, the salon
  -- counts as paid (only an admin refunds), even if the try's answer was lost.
  transfer_attempted_at timestamptz,
  -- Taken back from the transfer by admin refunds after the payout.
  reversed_amount numeric(10, 2) not null default 0 check (reversed_amount >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_coiffeur_id_idx on public.payments (coiffeur_id);
create index payments_particulier_id_idx on public.payments (particulier_id);
-- What the jobs below look through: paid, not transferred yet.
create index payments_untransferred_idx on public.payments (appointment_id)
  where status = 'succeeded' and transfer_id is null;

alter table public.payments enable row level security;

create trigger set_payments_updated_at
before update on public.payments for each row
execute procedure public.set_updated_at ();

-- The hourly payout job's list (PaymentsService.transferDue): paid,
-- accepted bookings over by p_cutoff (a day before now), not fully
-- refunded, at a salon whose payouts are on. Filtered here, so bookings
-- that will never be paid out (refused, refunded, the demo salon's) don't
-- pile up in the job's way. Never tried first: one that keeps failing
-- doesn't hold the others up. The API's service role only.
create function public.payouts_due (p_cutoff timestamptz, p_limit integer)
returns setof public.payments
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.payments p
  join public.appointments a on a.id = p.appointment_id
  join public.coiffeur_payout_accounts pa on pa.profile_id = p.coiffeur_id
  where p.status = 'succeeded'
    and p.transfer_id is null
    and p.refunded_amount < p.amount
    and a.status = 'confirmed'
    and a.starts_at + make_interval(mins => a.duration_min) <= p_cutoff
    and pa.stripe_account_id is not null
    and pa.payouts_enabled
  order by p.transfer_attempted_at nulls first, a.starts_at
  limit p_limit
$$;

-- Refunds a cancelled or refused booking is still owed — one that failed
-- when it happened (Stripe down); PaymentsService.refundOwed makes them.
create function public.refunds_owed (p_limit integer)
returns setof public.payments
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.payments p
  join public.appointments a on a.id = p.appointment_id
  where p.status = 'succeeded'
    and p.transfer_id is null
    and p.transfer_attempted_at is null
    and p.refunded_amount < p.amount
    and a.status in ('cancelled', 'refused')
  order by p.updated_at
  limit p_limit
$$;

revoke execute on function public.payouts_due (timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.refunds_owed (integer) from public, anon, authenticated;

-- The admins' « Rendez-vous » (TODO.md Phase 7): every booking — never a
-- slot held while its client pays — with its salon, its client and its
-- payment, filtered here so the pages stay right, the latest first. The
-- status as the apps read it: 'upcoming' is accepted and not over yet,
-- 'done' accepted and over (AppointmentsService's derivedStatus). Salon and
-- client match every word, accents aside, like search_salons()'s p_query.
-- Mirrored by FakeSupabaseService's adminAppointmentsRpc. The API's service
-- role only: it reads every client's name.
create function public.admin_appointments (
  p_status text default null,
  p_salon text default null,
  p_client text default null,
  -- When it starts: from p_from, before p_to.
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_now timestamptz default now(),
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  particulier_id uuid,
  coiffeur_id uuid,
  service_name text,
  price numeric,
  duration_min integer,
  starts_at timestamptz,
  status text,
  attendance text,
  cancelled_by text,
  created_at timestamptz,
  salon_name text,
  stylist_first_name text,
  stylist_last_name text,
  client_first_name text,
  client_last_name text,
  payment_status text,
  payment_amount numeric,
  refunded_amount numeric,
  commission_amount numeric,
  transfer_amount numeric,
  reversed_amount numeric,
  transferred_at timestamptz,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  select
    a.id,
    a.particulier_id,
    a.coiffeur_id,
    a.service_name,
    a.price,
    a.duration_min,
    a.starts_at,
    a.status,
    a.attendance,
    a.cancelled_by,
    a.created_at,
    cp.salon_name,
    ca.first_name,
    ca.last_name,
    c.first_name,
    c.last_name,
    p.status,
    p.amount,
    p.refunded_amount,
    p.commission_amount,
    p.transfer_amount,
    p.reversed_amount,
    p.transferred_at,
    count(*) over ()
  from public.appointments a
  left join public.coiffeur_profiles cp on cp.profile_id = a.coiffeur_id
  left join public.coiffeur_applications ca on ca.profile_id = a.coiffeur_id
  left join public.profiles c on c.id = a.particulier_id
  left join public.payments p on p.appointment_id = a.id
  where a.status <> 'awaiting_payment'
    and (
      p_status is null
      or (p_status = 'upcoming' and a.status = 'confirmed' and a.starts_at + make_interval(mins => a.duration_min) >= p_now)
      or (p_status = 'done' and a.status = 'confirmed' and a.starts_at + make_interval(mins => a.duration_min) < p_now)
      or (p_status in ('pending', 'refused', 'cancelled') and a.status = p_status)
    )
    and (p_from is null or a.starts_at >= p_from)
    and (p_to is null or a.starts_at < p_to)
    and (
      p_salon is null
      or not exists (
        select 1
        from regexp_split_to_table(extensions.unaccent(lower(btrim(p_salon))), '\s+') as w (word)
        where w.word <> ''
          and position(w.word in extensions.unaccent(lower(concat_ws(' ', cp.salon_name, ca.first_name, ca.last_name)))) = 0
      )
    )
    and (
      p_client is null
      or not exists (
        select 1
        from regexp_split_to_table(extensions.unaccent(lower(btrim(p_client))), '\s+') as w (word)
        where w.word <> ''
          and position(w.word in extensions.unaccent(lower(concat_ws(' ', c.first_name, c.last_name)))) = 0
      )
    )
  -- id last: equal starts keep one order, so pages never repeat or skip a booking.
  order by a.starts_at desc, a.id
  limit p_limit offset p_offset
$$;

revoke execute on function public.admin_appointments (text, text, text, timestamptz, timestamptz, timestamptz, integer, integer)
  from public, anon, authenticated;

-- "Avis" (TODO.md). One row per appointment (unique), so "Création avis" is
-- naturally capped at one review per booking. Every change feeds
-- coiffeur_profiles.rating/review_count through refresh_salon_rating()
-- below, so a salon's stars always match its non-hidden reviews.
create table public.reviews (
  id uuid primary key default gen_random_uuid (),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  -- Null once its author deleted their account: the review stays, as
  -- « Ancien client ». A deleted salon's reviews go with it.
  particulier_id uuid references public.profiles (id) on delete set null,
  coiffeur_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text not null default '',
  coiffeur_reply text,
  replied_at timestamptz,
  -- "Signalement / modération avis (admin)" — no back-office UI exists yet
  -- (separate TODO.md section), but the data model + API are built now,
  -- same as coiffeur_applications' admin review queue was.
  status text not null default 'visible' check (status in ('visible', 'reported', 'hidden')),
  report_reason text,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_coiffeur_id_idx on public.reviews (coiffeur_id);
create index reviews_particulier_id_idx on public.reviews (particulier_id);

alter table public.reviews enable row level security;

-- No write policies: creating, replying, reporting and moderating all go
-- through the API (src/reviews/), which checks the appointment really took
-- place and that only an admin can hide a review.
create policy "Visible to anyone, or its owner/admin regardless of status"
  on public.reviews for select
  using (
    status = 'visible'
    or (select auth.uid ()) = particulier_id
    or (select auth.uid ()) = coiffeur_id
    or public.is_admin ()
  );

create trigger set_reviews_updated_at
before update on public.reviews for each row
execute procedure public.set_updated_at ();

-- A salon's displayed rating is the average of its non-hidden reviews
-- (rounded to one decimal) and review_count their number — 0 and 0 until
-- the first review, which the app shows as "Nouveau". A reported review
-- still counts until an admin actually hides it.
create function public.refresh_salon_rating (p_coiffeur_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.coiffeur_profiles cp
  set
    rating = coalesce(agg.avg_rating, 0),
    review_count = agg.review_count
  from (
    select round(avg(r.rating)::numeric, 1) as avg_rating, count(*)::integer as review_count
    from public.reviews r
    where r.coiffeur_id = p_coiffeur_id and r.status <> 'hidden'
  ) agg
  where cp.profile_id = p_coiffeur_id;
$$;

create function public.refresh_salon_rating_on_review_change ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.refresh_salon_rating (old.coiffeur_id);
  end if;
  if tg_op <> 'DELETE' then
    perform public.refresh_salon_rating (new.coiffeur_id);
  end if;
  return null;
end;
$$;

-- Only the trigger calls these; they're not an RPC endpoint.
revoke execute on function public.refresh_salon_rating (uuid) from public, anon, authenticated;
revoke execute on function public.refresh_salon_rating_on_review_change () from public, anon, authenticated;

-- A coiffeur's reply doesn't change the rating, so it doesn't fire this.
create trigger refresh_salon_rating
after insert or update of rating, status, coiffeur_id or delete on public.reviews
for each row execute procedure public.refresh_salon_rating_on_review_change ();

-- "Signaler" (TODO.md Phase 6): who reported a review and why — once per
-- person and review. The review itself goes to the admins' queue
-- (status 'reported'). API only.
create table public.review_reports (
  review_id uuid not null references public.reviews (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('offensive', 'fake', 'personal_info', 'spam', 'other')),
  details text,
  created_at timestamptz not null default now(),
  primary key (review_id, reporter_id)
);

create index review_reports_reporter_id_idx on public.review_reports (reporter_id);

alter table public.review_reports enable row level security;

-- "Favoris" (TODO.md Phase 6): the salons a client keeps a heart on. API only.
create table public.favorites (
  particulier_id uuid not null references public.profiles (id) on delete cascade,
  coiffeur_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (particulier_id, coiffeur_id)
);

create index favorites_coiffeur_id_idx on public.favorites (coiffeur_id);

alter table public.favorites enable row level security;

-- ── Public photo storage ─────────────────────────────────────────────────────
--
-- Unlike coiffeur-documents, this bucket is PUBLIC: a particulier's avatar
-- and a coiffeur's salon cover photo are meant to be visible to other users
-- (reviews, salon cards, etc.), not just the owner. Path convention:
-- `{uid}/avatar.<ext>` or `{uid}/salon-cover.<ext>`.
insert into storage.buckets (id, name, public)
values ('user-photos', 'user-photos', true);

create policy "Users can upload their own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'user-photos'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

create policy "Users can replace or delete their own photos"
  on storage.objects for update
  using (
    bucket_id = 'user-photos'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

create policy "Users can delete their own photos"
  on storage.objects for delete
  using (
    bucket_id = 'user-photos'
    and (storage.foldername (name))[1] = auth.uid ()::text
  );

-- A SELECT policy IS needed even though this bucket is public: the public
-- read path (`public.buckets.public = true`) only covers anonymous fetches
-- of the public URL — an authenticated client's own upload (upsert checks
-- for an existing row first) is denied with a generic RLS error without one.
-- Confirmed by hand: uploads here failed until this policy was added.
create policy "Anyone can view user photos"
  on storage.objects for select
  using (bucket_id = 'user-photos');

-- ── Notifications (TODO.md) ──────────────────────────────────────────────────
--
-- Same shape as the WhaleTime project's approach (D:\Others\WhaleTime),
-- ported from Mongoose to Postgres: Expo push tokens, per-user reminder
-- preferences (only the two "désactivable" reminders get a toggle — the
-- other four notification types are mandatory, so they don't need one), and
-- a dedupe log keyed by a caller-chosen `dedupe_key` rather than a
-- pre-check read — a retried/overlapping cron run can't double-send.

create table public.push_tokens (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  timezone text not null default 'UTC',
  last_seen_at timestamptz not null default now(),
  invalidated_at timestamptz,
  created_at timestamptz not null default now()
);

-- Partial: only rows that would actually be sent to are ever looked up.
create index push_tokens_user_id_active_idx on public.push_tokens (user_id) where invalidated_at is null;

-- RLS on with no policy at all: only the API (service-role key) reads or
-- writes tokens, through /notifications/push-tokens.
alter table public.push_tokens enable row level security;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reminder_day_before boolean not null default true,
  reminder_hour_before boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Same as push_tokens: API only (/notifications/preferences), no policy.
alter table public.notification_preferences enable row level security;

create trigger set_notification_preferences_updated_at
before update on public.notification_preferences for each row
execute procedure public.set_updated_at ();

create table public.notifications_log (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  -- Caller-chosen, e.g. an appointment id for a reminder/RDV event, or
  -- "<applicationId>:<status>" for a coiffeur-application decision (so a
  -- later re-decision after resubmission still notifies again).
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create unique index notifications_log_dedupe_idx on public.notifications_log (user_id, type, dedupe_key);

alter table public.notifications_log enable row level security;

create policy "Users can view their own notification history"
  on public.notifications_log for select
  using ((select auth.uid ()) = user_id);

-- "Gestion des zones publicitaires" (TODO.md → Back-office admin, issue #5).
-- Fixed set of placements, one row per id — see mobile/src/services/ads.ts,
-- the mock seam this replaces.
create table public.ad_slots (
  id text primary key check (id in ('home_banner', 'search_results', 'booking_confirmation')),
  active boolean not null default false,
  headline text not null default '',
  image_url text,
  link_url text,
  updated_at timestamptz not null default now()
);

alter table public.ad_slots enable row level security;

-- Admins edit these through the API (/admin/ad-slots), not directly.
create policy "Anyone can view ad slots"
  on public.ad_slots for select
  using (true);

create trigger set_ad_slots_updated_at
before update on public.ad_slots for each row
execute procedure public.set_updated_at ();

insert into public.ad_slots (id, headline) values
  ('home_banner', 'Nos partenaires beauté'),
  ('search_results', 'Découvrez nos marques partenaires'),
  ('booking_confirmation', 'Prenez soin de vos cheveux entre deux rendez-vous');

-- "Gestion de contenu / pages" (TODO.md → Back-office admin, issue #5) — a
-- key/value content table (only one real key exists today: the 4e slide
-- onboarding, see mobile/src/services/content.ts), extensible to further
-- admin-managed copy without a schema change.
create table public.app_content (
  key text primary key,
  heading text not null default '',
  body text not null default '',
  image_url text,
  updated_at timestamptz not null default now()
);

alter table public.app_content enable row level security;

-- Admins edit this through the API (/admin/content), not directly.
create policy "Anyone can view app content"
  on public.app_content for select
  using (true);

create trigger set_app_content_updated_at
before update on public.app_content for each row
execute procedure public.set_updated_at ();

insert into public.app_content (key, heading, body) values
  ('onboarding_products_slide', 'Des produits de qualité', 'Nos coiffeurs travaillent avec des marques professionnelles, choisies pour prendre soin de chaque type de cheveux.');

-- Shared public bucket for both ad-slot and content images — admin-only
-- writes. In practice the admin web app uploads through the server
-- (service-role, bypasses RLS entirely — see
-- src/admin-media/admin-media.controller.ts), not straight from the browser;
-- these policies exist for correctness/any future direct-client path.
insert into storage.buckets (id, name, public)
values ('admin-media', 'admin-media', true);

create policy "Admin can upload admin media"
  on storage.objects for insert
  with check (bucket_id = 'admin-media' and public.is_admin ());

create policy "Admin can replace or delete admin media"
  on storage.objects for update
  using (bucket_id = 'admin-media' and public.is_admin ());

create policy "Admin can delete admin media"
  on storage.objects for delete
  using (bucket_id = 'admin-media' and public.is_admin ());

-- Same real gap as user-photos above: a SELECT policy is needed even on a
-- public bucket for an authenticated client's own upload/upsert to succeed.
create policy "Anyone can view admin media"
  on storage.objects for select
  using (bucket_id = 'admin-media');

-- « Exporter mes données » too large for the phone's share sheet (TODO.md
-- Phase 8): the server writes it here and hands out a link valid ten
-- minutes (DataExportService.downloadLink). Private, and no policy: only
-- the server's service role reads or writes it. Emptied every night
-- (DocumentRetentionJob), and a deleted account's file goes with it.
insert into storage.buckets (id, name, public)
values ('data-exports', 'data-exports', false);

-- A coiffeur's subscription (devis: "Abonnement professionnel Stripe", TODO.md
-- Phase 4). It lives in Stripe — sold on the website through Stripe Checkout,
-- managed in Stripe's Customer Portal — and this row mirrors it, kept current
-- by Stripe's webhooks (server/src/subscriptions/). search_salons() lists a
-- salon only while its row is live. A row with no Stripe subscription is an
-- offered one (seeded demo salons, launch partners), live until
-- current_period_end.
create table public.coiffeur_subscriptions (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'monthly' check (plan in ('monthly', 'yearly')),
  -- Stripe's own subscription statuses, word for word; 'none' until the
  -- coiffeur completes a first Checkout. 'expired' is never stored: the API
  -- derives it, like appointments' 'done'.
  status text not null default 'none' check (
    status in (
      'none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid',
      'incomplete', 'incomplete_expired', 'paused'
    )
  ),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  -- A cancellation scheduled in the portal: listed until then.
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coiffeur_subscriptions enable row level security;

-- Read-only for the coiffeur: a subscription only changes through Stripe's
-- webhooks, never by the coiffeur writing their own end date.
create policy "Coiffeur can view their own subscription, admin can view every subscription"
  on public.coiffeur_subscriptions for select
  using ((select auth.uid ()) = profile_id or public.is_admin ());

create trigger set_coiffeur_subscriptions_updated_at
before update on public.coiffeur_subscriptions for each row
execute procedure public.set_updated_at ();

-- What the admin tunes without a deploy (/admin/parametres): one row. The
-- commission on prestations joins it in TODO.md Phase 5. API only: no
-- policy, so the public roles read nothing.
create table public.platform_settings (
  id boolean primary key default true check (id),
  -- Free days a coiffeur's first subscription starts with (Stripe trial).
  trial_days integer not null default 30 check (trial_days between 0 and 365),
  -- WorldHair's share of each prestation paid in the app, in percent
  -- (TODO.md Phase 5); Stripe's card fees come out of it.
  commission_percent numeric(5, 2) not null default 10 check (commission_percent between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

create trigger set_platform_settings_updated_at
before update on public.platform_settings for each row
execute procedure public.set_updated_at ();

-- Defined after every table it reads (salon profiles, applications, services,
-- hours, closures, subscriptions, payout accounts): a SQL function's body is
-- checked when it's created.
--
-- Search does every filter, sort and page here (TODO.md Phase 6), so a
-- salon never goes missing past a download cap. p_lat/p_lng null means no
-- distance, which is the manual-location and filter-only cases.
-- "Open" filters read Paris wall-clock hours at p_now: a salon's week in
-- coiffeur_availability, or the default a new salon starts with
-- (SalonService.defaultAvailability: Mon-Sat 9-19, lunch 13-14).
-- Mirrored by FakeSupabaseService's searchSalonsRpc for the offline tests.
-- SECURITY INVOKER (the default): callers are always this app's server
-- using the service-role key, so RLS never actually applies here, but there
-- is no reason to reach for DEFINER when INVOKER already works.
create function public.search_salons(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  -- Any of them.
  p_specialties text[] default null,
  p_city text default null,
  -- Every word, accents aside: salon, coiffeur, tagline, address, city, prestations.
  p_query text default null,
  -- A visible prestation priced within the range.
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_open_now boolean default false,
  -- Open that Paris day.
  p_open_on date default null,
  -- Still open after this minute of the day: on p_open_on, or any day.
  p_open_after integer default null,
  p_practice_zone text default null,
  -- The map's visible area: {min_lat, min_lng, max_lat, max_lng}.
  p_bounds double precision[] default null,
  -- Only these salons (a client's favorites).
  p_ids uuid[] default null,
  -- 'distance' | 'rating' | 'price'; availability is sorted by the API.
  p_sort text default 'distance',
  p_now timestamptz default now(),
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  profile_id uuid,
  salon_name text,
  stylist_first_name text,
  stylist_last_name text,
  tagline text,
  description text,
  address_line text,
  postal_code text,
  city text,
  latitude double precision,
  longitude double precision,
  phone text,
  specialties text[],
  badges text[],
  rating numeric,
  review_count integer,
  cover_url text,
  price_from numeric,
  shortest_duration_min integer,
  practice_zone text,
  travel_radius_km integer,
  booking_notice_minutes integer,
  online_booking boolean,
  distance_km double precision,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with origin as (
    select
      case when p_lat is not null and p_lng is not null
        then extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography
      end as point
  ),
  paris as (
    select
      extract(dow from (p_now at time zone 'Europe/Paris'))::int as weekday,
      (extract(hour from (p_now at time zone 'Europe/Paris')) * 60
        + extract(minute from (p_now at time zone 'Europe/Paris')))::int as minute
  ),
  -- Not materialized: each filter then looks up one salon's day by key,
  -- instead of scanning a copy of every salon's week.
  hours as not materialized (
    select a.profile_id, a.weekday, a.is_open, a.opens_minute, a.closes_minute, a.break_start_minute, a.break_end_minute
    from public.coiffeur_availability a
    union all
    select cp.profile_id, d.weekday, d.weekday <> 0, 540, 1140,
      case when d.weekday <> 0 then 780 end,
      case when d.weekday <> 0 then 840 end
    from public.coiffeur_profiles cp
    cross join generate_series(0, 6) as d (weekday)
    where not exists (select 1 from public.coiffeur_availability a where a.profile_id = cp.profile_id)
  ),
  matches as (
    select
      cp.profile_id,
      cp.salon_name,
      ca.first_name as stylist_first_name,
      ca.last_name as stylist_last_name,
      cp.tagline,
      cp.description,
      cp.address_line,
      cp.postal_code,
      cp.city,
      cp.latitude,
      cp.longitude,
      cp.phone,
      cp.specialties,
      cp.badges,
      cp.rating,
      cp.review_count,
      cp.cover_url,
      (select min(cs.price) from public.coiffeur_services cs where cs.profile_id = cp.profile_id and cs.is_active) as price_from,
      (select min(cs.duration_min) from public.coiffeur_services cs where cs.profile_id = cp.profile_id and cs.is_active) as shortest_duration_min,
      cp.practice_zone,
      cp.travel_radius_km,
      cp.booking_notice_minutes,
      coalesce((pa.stripe_account_id is not null and pa.payouts_enabled) or pa.bookable_without_payouts, false) as online_booking,
      case
        when (select point from origin) is not null and cp.location is not null
        then extensions.ST_Distance(cp.location, (select point from origin)) / 1000.0
      end as distance_km
    from public.coiffeur_profiles cp
    join public.coiffeur_applications ca
      on ca.profile_id = cp.profile_id
      and ca.status = 'validated'
      and ca.shop_profile_complete = true
    -- Suspended and banned salons (admin → Comptes) disappear from search.
    join public.profiles p
      on p.id = cp.profile_id
      and p.account_status = 'active'
    -- So do salons without a live subscription (TODO.md Phase 4): Stripe's
    -- trialing, active, or past_due while it retries a failed payment —
    -- unless its period is over by more than Stripe's 3 days of webhook
    -- retries, meaning the news stopped coming; an offered subscription (no
    -- Stripe one) until its end date. Mirrored by
    -- server/src/subscriptions/subscription-state.ts's isListed().
    join public.coiffeur_subscriptions s
      on s.profile_id = cp.profile_id
      and s.status in ('trialing', 'active', 'past_due')
      and (
        (s.stripe_subscription_id is not null
          and (s.current_period_end is null or s.current_period_end > now() - interval '3 days'))
        or (s.stripe_subscription_id is null and s.current_period_end > now())
      )
    left join public.coiffeur_payout_accounts pa on pa.profile_id = cp.profile_id
    where
      (p_ids is null or cp.profile_id = any (p_ids))
      and (p_specialties is null or cardinality(p_specialties) = 0 or cp.specialties && p_specialties)
      and (p_city is null or cp.city ilike p_city)
      and (p_practice_zone is null or cp.practice_zone = p_practice_zone)
      and (
        p_query is null
        or not exists (
          select 1
          from regexp_split_to_table(extensions.unaccent(lower(btrim(p_query))), '\s+') as w (word)
          where w.word <> ''
            and position(w.word in extensions.unaccent(lower(concat_ws(' ',
              cp.salon_name, ca.first_name, ca.last_name, cp.tagline, cp.city, cp.postal_code, cp.address_line,
              (select string_agg(cs.name, ' ') from public.coiffeur_services cs where cs.profile_id = cp.profile_id and cs.is_active)
            )))) = 0
        )
      )
      and (
        (p_price_min is null and p_price_max is null)
        or exists (
          select 1 from public.coiffeur_services cs
          where cs.profile_id = cp.profile_id
            and cs.is_active
            and (p_price_min is null or cs.price >= p_price_min)
            and (p_price_max is null or cs.price <= p_price_max)
        )
      )
      and (
        not p_open_now
        or (
          exists (
            select 1 from hours h, paris
            where h.profile_id = cp.profile_id
              and h.is_open
              and h.weekday = paris.weekday
              and paris.minute >= h.opens_minute
              and paris.minute < h.closes_minute
              and not (
                h.break_start_minute is not null
                and h.break_end_minute is not null
                and paris.minute >= h.break_start_minute
                and paris.minute < h.break_end_minute
              )
          )
          and not exists (
            select 1 from public.coiffeur_time_off t
            -- A salon closure; one person's congé leaves the salon open.
            where t.profile_id = cp.profile_id and t.staff_id is null and t.starts_at <= p_now and t.ends_at > p_now
          )
        )
      )
      and (
        p_open_on is null
        or exists (
          select 1 from hours h
          where h.profile_id = cp.profile_id
            and h.is_open
            and h.weekday = extract(dow from p_open_on)::int
            and (p_open_after is null or h.closes_minute > p_open_after)
            -- A closure over the whole of it (from p_open_after, when given) closes the day.
            and not exists (
              select 1 from public.coiffeur_time_off t
              where t.profile_id = cp.profile_id
                and t.staff_id is null
                and t.starts_at <= ((p_open_on + make_interval(mins => greatest(h.opens_minute, coalesce(p_open_after, 0)))) at time zone 'Europe/Paris')
                and t.ends_at >= ((p_open_on + make_interval(mins => h.closes_minute)) at time zone 'Europe/Paris')
            )
        )
      )
      and (
        p_open_after is null
        or p_open_on is not null
        or exists (select 1 from hours h where h.profile_id = cp.profile_id and h.is_open and h.closes_minute > p_open_after)
      )
      and (
        p_bounds is null
        or (
          cp.latitude between p_bounds[1] and p_bounds[3]
          and cp.longitude between p_bounds[2] and p_bounds[4]
        )
      )
      and (
        -- A salon with no known location is excluded from a radius search,
        -- not passed through by virtue of "we can't check". A home-service
        -- coiffeur comes to the client: their own radius decides, below.
        p_radius_km is null or (select point from origin) is null
        or cp.practice_zone = 'domicile'
        or (cp.location is not null and extensions.ST_DWithin(cp.location, (select point from origin), p_radius_km * 1000))
      )
      and (
        -- A home-service coiffeur only shows to clients they'd travel to —
        -- except by name (a client's favorites), wherever the client is.
        p_ids is not null
        or cp.practice_zone <> 'domicile'
        or cp.travel_radius_km is null
        or (select point from origin) is null
        or cp.location is null
        or extensions.ST_DWithin(cp.location, (select point from origin), cp.travel_radius_km * 1000)
      )
  )
  select *, count(*) over () as total_count
  from matches
  -- profile_id last: equals keep one order, so pages never repeat or skip a salon.
  order by
    case when p_sort = 'price' then price_from end asc nulls last,
    case when p_sort = 'rating' then rating end desc nulls last,
    case when p_sort = 'rating' then review_count end desc nulls last,
    distance_km asc nulls last,
    rating desc,
    profile_id
  limit p_limit offset p_offset;
$$;

grant execute on function public.search_salons to authenticated;

-- ── Client write lockdown ────────────────────────────────────────────────────
--
-- The mobile app and the admin site ship Supabase's public (anon) key. RLS
-- policies alone aren't enough behind it: a policy that lets a user update
-- "their own row" lets them update every column of it (role, account_status,
-- rating, subscription dates...). So the public roles lose every write
-- privilege on this schema, and get back exactly one: a user's own name and
-- photo (profile setup writes them directly — see mobile/src/services/auth.ts).
-- Everything else goes through the API with the service-role key, which
-- bypasses both RLS and these grants. Storage uploads are unaffected (they
-- live in the storage schema, under their own policies above).
-- `bun run check:rls` (server/) verifies this against a live project.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

grant update (first_name, last_name, photo_url) on public.profiles to authenticated;

-- Tables added later start locked too, instead of inheriting Supabase's
-- default "everything" grant.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
