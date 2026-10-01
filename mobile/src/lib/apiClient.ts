import { create, isAxiosError } from "axios";
import { supabase } from "./supabase";

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!baseURL) {
  throw new Error("Missing EXPO_PUBLIC_API_BASE_URL — see .env.example.");
}

/**
 * Talks to the NestJS server (server/src) — never Supabase directly. Every
 * request carries the caller's own Supabase-issued access token; the server
 * verifies it itself (see server/src/auth/strategies/supabase.strategy.ts)
 * rather than this client deciding who it is.
 */
export const apiClient = create({ baseURL });

apiClient.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

/**
 * The server refused the session itself (account deleted, token revoked):
 * it can't come back, so it's dropped on this device and the app goes back
 * to sign-in instead of failing every call. Only if it's still the one
 * signed in — a late answer about an earlier account leaves the new one be.
 */
apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  const sent = isAxiosError(error) ? error.config?.headers?.Authorization : undefined;
  if (isAxiosError(error) && error.response?.status === 401 && typeof sent === "string") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session && sent === `Bearer ${session.access_token}`) {
      await supabase.auth.signOut({ scope: "local" });
    }
  }
  throw error;
});
