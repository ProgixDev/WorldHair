/**
 * The shape most hand-rolled test doubles in this repo have: a flat bag of
 * `jest.fn()`s standing in for a Mongoose model or a collaborating service.
 *
 * Exists so specs can name that shape instead of reaching for `any`, which
 * silently disables checking on every call made through the double —
 * including the argument assertions the spec is there to make.
 *
 * Type-only: this module emits no runtime code.
 */
export type MockCollaborator = Record<string, jest.Mock>;
