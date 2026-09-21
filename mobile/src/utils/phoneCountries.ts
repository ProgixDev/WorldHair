import { getCountries, getCountryCallingCode } from "libphonenumber-js/min";
import type { CountryCode } from "libphonenumber-js/min";

export interface PhoneCountry {
  iso: CountryCode;
  dialCode: string;
  name: string;
  flag: string;
}

/**
 * Regional-indicator flag emoji from a 2-letter ISO code — no data table
 * needed, it's a fixed Unicode offset per letter (🇫 + 🇷 = 🇫🇷).
 */
function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join("");
}

/**
 * `Intl.DisplayNames` is well-supported on Hermes for the RN/Expo version
 * this app targets, but this still degrades to the bare ISO code rather than
 * throwing if a given device's ICU data is somehow incomplete — a missing
 * country name is a cosmetic problem, not a reason to break the picker.
 */
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    return null;
  }
})();

function countryName(iso: string): string {
  try {
    return regionNames?.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/** Every dialable country/territory, France first, then alphabetical by French name. */
export const PHONE_COUNTRIES: PhoneCountry[] = getCountries()
  .map((iso) => ({
    iso,
    dialCode: getCountryCallingCode(iso),
    name: countryName(iso),
    flag: flagEmoji(iso),
  }))
  .sort((a, b) => {
    if (a.iso === "FR") return -1;
    if (b.iso === "FR") return 1;
    return a.name.localeCompare(b.name, "fr");
  });

export function phoneCountryFor(iso: string): PhoneCountry {
  return (
    PHONE_COUNTRIES.find((country) => country.iso === iso) ?? PHONE_COUNTRIES[0]
  );
}
