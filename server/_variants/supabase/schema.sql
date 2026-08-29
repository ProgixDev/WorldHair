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
  role text not null default 'particulier' check (role in ('particulier', 'coiffeur', 'admin')),
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

create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid ()) = id);

-- The server itself talks to Postgres with the SERVICE ROLE key
-- (see src/database/supabase.service.ts), which bypasses RLS entirely — the
-- policies above are what protect this table if it's ever queried with a
-- user's own (anon-key) session instead, e.g. directly from the client.

-- Auto-create an empty profile row whenever a new auth user signs up, so
-- `GET /users/me` always has a row to find (see src/users/users.service.ts).
-- Only ever invoked by the trigger below, never directly — EXECUTE is
-- revoked from PUBLIC so it can't be called as a PostgREST RPC endpoint
-- despite being SECURITY DEFINER.
create function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
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
    or exists (select 1 from public.profiles where id = (select auth.uid ()) and role = 'admin')
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
    and exists (select 1 from public.profiles where id = auth.uid () and role = 'admin')
  );

-- ── Coiffeur workspace (TODO.md → Backend → "Profils") ──────────────────────
--
-- The coiffeur's ongoing "Mon salon" page, prestations and weekly hours —
-- distinct from `coiffeur_applications` above, which is the one-time
-- onboarding snapshot. Mirrors mobile's ProProfile/ProService/AvailabilityDay
-- (see mobile/src/features/pro/types.ts) now that there's a real backend.
--
-- All three tables are readable by anyone (`using (true)`): a particulier
-- will need this once search/discovery moves off its mock catalogue
-- (TODO.md → Recherche & géolocalisation) — opened now rather than
-- re-touching this RLS later for the same tables. Only the owning coiffeur
-- may write.
-- PostGIS powers real radius search (ST_DWithin/ST_Distance on a geography
-- point) for search_salons() below, instead of hand-rolled Haversine SQL.
create extension if not exists postgis with schema extensions;

create table public.coiffeur_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  salon_name text not null default '',
  tagline text not null default '',
  description text not null default '',
  address_line text not null default '',
  postal_code text not null default '',
  city text not null default '',
  phone text not null default '',
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
  -- Seeded/system-computed display fields — deliberately NOT part of
  -- UpdateSalonProfileDto. rating/review_count will eventually be aggregated
  -- from real reviews once "Avis" (TODO.md) exists; badges are editorial.
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  badges text[] not null default '{}',
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

-- Split by action rather than one `for all` policy: a `for all` would also
-- cover SELECT and duplicate the "anyone can view" policy just below on that
-- action, which Postgres would then evaluate twice per read.
create policy "Coiffeurs can insert their own salon profile"
  on public.coiffeur_profiles for insert
  with check ((select auth.uid ()) = profile_id);

create policy "Coiffeurs can update their own salon profile"
  on public.coiffeur_profiles for update
  using ((select auth.uid ()) = profile_id)
  with check ((select auth.uid ()) = profile_id);

create policy "Coiffeurs can delete their own salon profile"
  on public.coiffeur_profiles for delete
  using ((select auth.uid ()) = profile_id);

create policy "Anyone can view a salon profile"
  on public.coiffeur_profiles for select
  using (true);

create trigger set_coiffeur_profiles_updated_at
before update on public.coiffeur_profiles for each row
execute procedure public.set_updated_at ();

-- Backs both geo-radius search and manual-location/filter-only search (see
-- TODO.md "Recherche & géolocalisation" and src/discovery/) —
-- p_lat/p_lng/p_radius_km null means "no distance filter, no distance
-- column", which is exactly the manual-location and filter-only cases.
-- SECURITY INVOKER (the default): callers are always this app's server
-- using the service-role key, so RLS never actually applies here, but there
-- is no reason to reach for DEFINER when INVOKER already works.
create or replace function public.search_salons(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null,
  p_specialty text default null,
  p_city text default null,
  p_query text default null,
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
      (select min(cs.price) from public.coiffeur_services cs where cs.profile_id = cp.profile_id) as price_from,
      case
        when (select point from origin) is not null and cp.location is not null
        then extensions.ST_Distance(cp.location, (select point from origin)) / 1000.0
      end as distance_km
    from public.coiffeur_profiles cp
    join public.coiffeur_applications ca
      on ca.profile_id = cp.profile_id
      and ca.status = 'validated'
      and ca.shop_profile_complete = true
    where
      (p_specialty is null or p_specialty = any (cp.specialties))
      and (p_city is null or cp.city ilike p_city)
      and (p_query is null or cp.salon_name ilike '%' || p_query || '%')
      and (
        -- A salon with no known location is excluded from a radius search,
        -- not passed through by virtue of "we can't check".
        p_radius_km is null or (select point from origin) is null
        or (cp.location is not null and extensions.ST_DWithin(cp.location, (select point from origin), p_radius_km * 1000))
      )
  )
  select *, count(*) over () as total_count
  from matches
  order by
    distance_km asc nulls last,
    rating desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.search_salons to authenticated;

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

create policy "Coiffeurs can insert their own availability"
  on public.coiffeur_availability for insert
  with check ((select auth.uid ()) = profile_id);

create policy "Coiffeurs can update their own availability"
  on public.coiffeur_availability for update
  using ((select auth.uid ()) = profile_id)
  with check ((select auth.uid ()) = profile_id);

create policy "Coiffeurs can delete their own availability"
  on public.coiffeur_availability for delete
  using ((select auth.uid ()) = profile_id);

create policy "Anyone can view availability"
  on public.coiffeur_availability for select
  using (true);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coiffeur_services enable row level security;

create policy "Coiffeurs can insert their own services"
  on public.coiffeur_services for insert
  with check ((select auth.uid ()) = profile_id);

create policy "Coiffeurs can update their own services"
  on public.coiffeur_services for update
  using ((select auth.uid ()) = profile_id)
  with check ((select auth.uid ()) = profile_id);

create policy "Coiffeurs can delete their own services"
  on public.coiffeur_services for delete
  using ((select auth.uid ()) = profile_id);

create policy "Anyone can view services"
  on public.coiffeur_services for select
  using (true);

create trigger set_coiffeur_services_updated_at
before update on public.coiffeur_services for each row
execute procedure public.set_updated_at ();

-- Every write goes through WHERE profile_id = ..., so this index earns its
-- keep despite the linter flagging it as unused on a brand-new, empty table.
create index coiffeur_services_profile_id_idx on public.coiffeur_services (profile_id);

-- "Rendez-vous / Agenda" (TODO.md). One row per booking, spanning its whole
-- lifecycle (pending -> confirmed/refused, confirmed -> cancelled). "done" is
-- NOT a stored status — the API derives it (confirmed + already past) at
-- read time, so there's no cron/background job needed to transition it.
create table public.appointments (
  id uuid primary key default gen_random_uuid (),
  particulier_id uuid not null references public.profiles (id) on delete cascade,
  coiffeur_id uuid not null references public.profiles (id) on delete cascade,
  -- Nullable + a snapshot alongside: a coiffeur editing/deleting a service
  -- later must never retroactively change what a past booking says it was.
  service_id uuid references public.coiffeur_services (id) on delete set null,
  service_name text not null,
  price numeric(10, 2) not null check (price > 0),
  duration_min integer not null check (duration_min > 0),
  starts_at timestamptz not null,
  status text not null default 'pending' check (
    status in ('pending', 'confirmed', 'refused', 'cancelled')
  ),
  client_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_coiffeur_id_starts_at_idx on public.appointments (coiffeur_id, starts_at);
create index appointments_particulier_id_idx on public.appointments (particulier_id);
create index appointments_service_id_idx on public.appointments (service_id);

alter table public.appointments enable row level security;

-- One combined SELECT policy, not two: a separate policy per side would
-- both be permissive on the same action, which Postgres evaluates twice
-- per read for no benefit (same fix as coiffeur_applications' policy).
create policy "Participant can view their own appointment"
  on public.appointments for select
  using ((select auth.uid ()) = particulier_id or (select auth.uid ()) = coiffeur_id);

create policy "Particuliers can create their own appointment requests"
  on public.appointments for insert
  with check ((select auth.uid ()) = particulier_id);

create policy "Participant can update their own appointment"
  on public.appointments for update
  using ((select auth.uid ()) = particulier_id or (select auth.uid ()) = coiffeur_id)
  with check ((select auth.uid ()) = particulier_id or (select auth.uid ()) = coiffeur_id);

create trigger set_appointments_updated_at
before update on public.appointments for each row
execute procedure public.set_updated_at ();

-- "Avis" (TODO.md). One row per appointment (unique), so "Création avis" is
-- naturally capped at one review per booking. Deliberately does NOT feed
-- back into coiffeur_profiles.rating/review_count — those stay independent
-- seed/display numbers, same decoupling the original mock catalogue always
-- had (reviewCount was never == len(reviews) there either).
create table public.reviews (
  id uuid primary key default gen_random_uuid (),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  particulier_id uuid not null references public.profiles (id) on delete cascade,
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

create policy "Particuliers can create their own review"
  on public.reviews for insert
  with check ((select auth.uid ()) = particulier_id);

create policy "Visible to anyone, or its owner/admin regardless of status"
  on public.reviews for select
  using (
    status = 'visible'
    or (select auth.uid ()) = particulier_id
    or (select auth.uid ()) = coiffeur_id
    or exists (select 1 from public.profiles where id = (select auth.uid ()) and role = 'admin')
  );

-- Server-side "signaler" (any authenticated caller) is enforced in
-- ReviewsService via the service-role key, not here — this policy only
-- covers the coiffeur's own reply + admin moderation.
create policy "Coiffeur or admin can update a review"
  on public.reviews for update
  using (
    (select auth.uid ()) = coiffeur_id
    or exists (select 1 from public.profiles where id = (select auth.uid ()) and role = 'admin')
  )
  with check (
    (select auth.uid ()) = coiffeur_id
    or exists (select 1 from public.profiles where id = (select auth.uid ()) and role = 'admin')
  );

create trigger set_reviews_updated_at
before update on public.reviews for each row
execute procedure public.set_updated_at ();

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

-- No SELECT policy needed: `public.buckets.public = true` serves reads
-- through a public URL without going through Storage RLS at all.

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

alter table public.push_tokens enable row level security;

-- One `for all` policy is fine here (no separate public-read policy exists
-- on this table to double up with, unlike coiffeur_profiles etc.).
create policy "Users manage their own push tokens"
  on public.push_tokens for all
  using ((select auth.uid ()) = user_id)
  with check ((select auth.uid ()) = user_id);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reminder_day_before boolean not null default true,
  reminder_hour_before boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "Users manage their own notification preferences"
  on public.notification_preferences for all
  using ((select auth.uid ()) = user_id)
  with check ((select auth.uid ()) = user_id);

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
