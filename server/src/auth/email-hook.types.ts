/**
 * Shape of the payload Supabase's "Send Email" Auth Hook POSTs — see
 * https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook. Every
 * `email_data` field is always present, just possibly `''` when not
 * applicable to the current action (Supabase's own example payload shows
 * this — `token_new`, `old_email`, etc. sent as empty strings rather than
 * omitted), so these are typed as `string`, not `string | undefined`.
 */

export type EmailActionType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email'
  | 'reauthentication'
  | 'password_changed_notification'
  | 'email_changed_notification'
  | 'phone_changed_notification'
  | 'identity_linked_notification'
  | 'identity_unlinked_notification'
  | 'mfa_factor_enrolled_notification'
  | 'mfa_factor_unenrolled_notification';

export interface EmailHookUser {
  id: string;
  email: string;
  /** Only populated mid email-change — the address being switched to. */
  new_email?: string;
}

export interface EmailHookData {
  /** The 6-digit OTP — what the app's verify-code screens read. */
  token: string;
  /**
   * The same code, hashed — plug this into Supabase's own `/auth/v1/verify`
   * endpoint to build a clickable link instead of showing the code, see
   * `buildVerifyUrl` in email-hook.service.ts.
   */
  token_hash: string;
  redirect_to: string;
  email_action_type: EmailActionType;
  site_url: string;
  /**
   * email_change only, and only when "Secure Email Change" is on: the second
   * OTP pair. See email-hook.service.ts's `resolveEmailChangeRecipients` for
   * the (counterintuitive, Supabase-documented) rule for which pair goes to
   * which address.
   */
  token_new: string;
  token_hash_new: string;
}

export interface EmailHookPayload {
  user: EmailHookUser;
  email_data: EmailHookData;
}
