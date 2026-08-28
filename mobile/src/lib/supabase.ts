import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — see .env.example.",
  );
}

/**
 * The one client-side Supabase client: real auth (signUp/signInWithPassword/
 * verifyOtp/resend/signOut — see services/auth.ts) and direct, RLS-scoped
 * reads/writes of the caller's own `profiles` row. Never carries the service
 * role key — that only ever lives on the server (see
 * server/src/database/supabase.service.ts).
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
