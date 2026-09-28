/**
 * Runs every unit and e2e suite in UTC, the timezone the production server
 * (Render) actually runs in — so a date bug that only appears outside
 * Europe/Paris can't hide behind the developer machine's own timezone.
 * Workers are forked after this runs, so they inherit it.
 */
export default function forceUtc(): void {
  process.env.TZ = 'UTC';
}
