/** Pure form validators — no React, no I/O, so they stay trivially testable. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** FR mobile/landline, tolerant of spaces, dots, dashes and +33. */
const PHONE_FR_RE = /^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
const POSTAL_FR_RE = /^\d{5}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export interface PasswordStrength {
  /** 0–4: length, case mix, digit, symbol. */
  score: number;
  isValid: boolean;
  /** Human-readable unmet requirements, in French. */
  issues: string[];
}

export function checkPassword(value: string): PasswordStrength {
  const issues: string[] = [];
  if (value.length < 8) issues.push("8 caractères minimum");
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value))
    issues.push("une majuscule et une minuscule");
  if (!/\d/.test(value)) issues.push("un chiffre");

  const score =
    (value.length >= 8 ? 1 : 0) +
    (/[a-z]/.test(value) && /[A-Z]/.test(value) ? 1 : 0) +
    (/\d/.test(value) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(value) ? 1 : 0);

  return { score, isValid: issues.length === 0, issues };
}

export function isValidName(value: string): boolean {
  return value.trim().length >= 2;
}

export function isValidPhoneFr(value: string): boolean {
  return PHONE_FR_RE.test(value.trim());
}

export function isValidPostalCodeFr(value: string): boolean {
  return POSTAL_FR_RE.test(value.trim());
}

export function isValidVerificationCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

/** First error message for a field, or undefined when the value passes. */
export function firstError(
  value: string,
  rules: { test: (v: string) => boolean; message: string }[],
): string | undefined {
  return rules.find((rule) => !rule.test(value))?.message;
}
