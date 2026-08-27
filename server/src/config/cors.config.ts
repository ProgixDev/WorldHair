/**
 * Empty config means "any origin" — acceptable for local dev and for a mobile
 * client (native apps send no Origin header). Production should set the list.
 */
export function parseCorsOrigins(raw: string): true | string[] {
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length === 0 ? true : origins;
}
