/**
 * The one definition of a legal handle. Mirrored into the DTO's `@Matches`.
 * Kept identical to the mongodb variant's copy of this file so a template
 * user switching variants doesn't have to change anything client-side.
 *
 * Lowercase only: usernames are compared case-insensitively by storing them
 * already-lowered, so the `profiles.username` unique constraint alone
 * enforces "no two users differing only in case" without a second normalized
 * column.
 */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}
