import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — see .env.example.",
  );
}

/**
 * Client-side only — same project mobile/server use. Mirrors mobile's
 * lib/supabase.ts (real signInWithPassword, session in browser storage by
 * default here since there's no AsyncStorage to swap in). Never carries the
 * service role key — that only ever lives on the server.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
