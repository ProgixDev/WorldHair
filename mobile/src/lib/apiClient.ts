import { create } from "axios";
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
