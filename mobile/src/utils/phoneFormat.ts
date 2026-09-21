import type { CountryCode } from "libphonenumber-js/min";
import { parsePhoneNumber } from "libphonenumber-js/min";
import { phoneCountryFor } from "./phoneCountries";

const DEFAULT_PHONE_COUNTRY = "FR";

/**
 * Splits a stored E.164 number (or "") the same way the signup wizard keeps
 * it — country + national digits, no dial code — so PhoneField (which only
 * ever displays/edits that split form) can show it. See services/pro.ts's
 * getProProfile and app/auth/pro/identity.tsx's ProApplicationContext draft.
 */
export function splitPhone(e164: string): { phone: string; phoneCountry: string } {
  if (!e164) return { phone: "", phoneCountry: DEFAULT_PHONE_COUNTRY };
  const fallback = { phone: e164.replace(/\D/g, ""), phoneCountry: DEFAULT_PHONE_COUNTRY };
  try {
    // A default country is required even for a "+"-prefixed number here:
    // parsePhoneNumber's "never throws" contract only covers a malformed
    // number, not a missing country hint — a legacy, non-E.164 value (typed
    // before this field used PhoneField) has neither a "+" nor a hint, and
    // throws ParseError('INVALID_COUNTRY') without one. The hint is ignored
    // for a real "+"-prefixed number, so it's harmless for the normal case.
    const parsed = parsePhoneNumber(e164, DEFAULT_PHONE_COUNTRY as CountryCode);
    return parsed?.country ? { phone: parsed.nationalNumber, phoneCountry: parsed.country } : fallback;
  } catch {
    return fallback;
  }
}

/** Reassembles the E.164 number the server stores — same fallback as documents.tsx's own submit. */
export function joinPhone(phone: string, phoneCountry: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const fallback = "+" + phoneCountryFor(phoneCountry).dialCode + trimmed;
  try {
    return parsePhoneNumber(trimmed, phoneCountry as CountryCode)?.number ?? fallback;
  } catch {
    return fallback;
  }
}
