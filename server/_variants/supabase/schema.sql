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

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_length check (username is null or char_length(username) between 3 and 20)
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid () = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid () = id);

-- The server itself talks to Postgres with the SERVICE ROLE key
-- (see src/database/supabase.service.ts), which bypasses RLS entirely — the
-- policies above are what protect this table if it's ever queried with a
-- user's own (anon-key) session instead, e.g. directly from the client.

-- Auto-create an empty profile row whenever a new auth user signs up, so
-- `GET /users/me` always has a row to find (see src/users/users.service.ts).
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

create trigger on_auth_user_created
after insert on auth.users for each row
execute procedure public.handle_new_user ();

-- Keep updated_at current on every profile edit.
create function public.set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles for each row
execute procedure public.set_updated_at ();
