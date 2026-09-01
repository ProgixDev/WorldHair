import axios from "axios";
import { supabase } from "./supabase";

const baseURL = process.env.NEXT_PUBLIC_API_URL;

if (!baseURL) {
  throw new Error("Missing NEXT_PUBLIC_API_URL — see .env.example.");
}

/**
 * Talks to the NestJS server (server/src) — never Supabase directly. Every
 * request carries the admin's own Supabase-issued access token; the server
 * verifies it itself (see server/src/auth/strategies/supabase.strategy.ts)
 * and gates `@Roles('admin')` routes from `profiles.role`, not this client.
 * Mirrors mobile/src/lib/apiClient.ts exactly.
 */
export const apiClient = axios.create({ baseURL });

apiClient.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
