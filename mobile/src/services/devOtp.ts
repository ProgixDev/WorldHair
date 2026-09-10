import { apiClient } from "../lib/apiClient";

/**
 * Dev-only convenience: fetches the signup OTP the server's
 * `DevOtpStore` stashed when Supabase's Send Email Hook fired, so
 * verify-email.tsx can auto-fill it instead of you copying a code out of
 * Render's logs. The server 404s this route outright once `NODE_ENV=
 * production` (see server/src/auth/dev-otp.controller.ts), so this is
 * already a no-op against a production deployment even if this function
 * were somehow called there — the `__DEV__` gate at the call site is the
 * first line of defense, not the only one.
 */
export async function fetchDevOtp(email: string): Promise<string | null> {
  try {
    const { data } = await apiClient.get<{ token: string | null }>(
      "/auth/dev/last-otp",
      { params: { email } },
    );
    return data.token;
  } catch {
    return null;
  }
}
