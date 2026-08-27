/**
 * The one definition of a legal handle. Mirrored into the schema's `match`
 * and the DTO's `@Matches` so all three can never drift apart.
 *
 * Lowercase only: usernames are compared and looked up case-insensitively by
 * storing them already-lowered, which means the unique index alone enforces
 * "no two users differing only in case" without a second normalized field.
 */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}
