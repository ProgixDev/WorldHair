import type { CountryCode, PhoneNumber } from "libphonenumber-js/min";
import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumber,
} from "libphonenumber-js/min";
import { phoneCountryFor } from "./phoneCountries";

const DEFAULT_PHONE_COUNTRY: CountryCode = "FR";

/**
 * The country to show for a parsed number. The one the coiffeur picked wins
 * whenever it's consistent with the number's calling code: a calling code can
 * be shared (+1 covers ~25 countries), and for an unassigned range the library
 * can't narrow it down on its own at all — it reports every +1 country as
 * equally possible. Without a usable pick, the library's own answer, then the
 * calling code's main country (US for +1) — never a different calling code.
 */
function countryFor(parsed: PhoneNumber, preferred: string | null | undefined): CountryCode {
  if (
    preferred &&
    isSupportedCountry(preferred) &&
    getCountryCallingCode(preferred) === parsed.countryCallingCode
  )
    return preferred;
  return parsed.country ?? parsed.getPossibleCountries()[0] ?? DEFAULT_PHONE_COUNTRY;
}

/**
 * Splits a stored E.164 number (or "") the same way the signup wizard keeps
 * it — country + national digits, no dial code — so PhoneField (which only
 * ever displays/edits that split form) can show it. `preferredCountry` is the
 * country stored alongside the number (coiffeur_profiles.phone_country).
 */
export function splitPhone(
  e164: string,
  preferredCountry?: string | null,
): { phone: string; phoneCountry: string } {
  const hint =
    preferredCountry && isSupportedCountry(preferredCountry) ? preferredCountry : DEFAULT_PHONE_COUNTRY;
  if (!e164) return { phone: "", phoneCountry: hint };
  const fallback = { phone: e164.replace(/\D/g, ""), phoneCountry: hint };
  try {
    // The hint matters for a legacy, non-E.164 value (typed before this field
    // used PhoneField): without one, parsePhoneNumber throws
    // ParseError('INVALID_COUNTRY') — its "never throws" contract only covers
    // a malformed number. It's ignored for a real "+"-prefixed number.
    const parsed = parsePhoneNumber(e164, hint);
    return parsed ? { phone: parsed.nationalNumber, phoneCountry: countryFor(parsed, preferredCountry) } : fallback;
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
