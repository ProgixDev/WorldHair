/**
 * Salon hours, reminders and admin stats are all French wall-clock times,
 * but the server runs in UTC (Render). Everything that turns an instant into
 * a weekday, an hour or a day boundary goes through here instead of
 * `Date#getHours()`/`getDay()`, which read the machine's own timezone.
 */
export const PARIS_TIME_ZONE = 'Europe/Paris';

export interface ParisParts {
  year: number;
  /** 1 = January. */
  month: number;
  day: number;
  /** 0 = Sunday, same as `Date#getDay`. */
  weekday: number;
  /** 0-23. */
  hour: number;
  minute: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PARIS_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
});

/** What a clock in Paris shows at this instant. */
export function parisParts(date: Date): ParisParts {
  const parts = new Map(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.get('year')),
    month: Number(parts.get('month')),
    day: Number(parts.get('day')),
    weekday: WEEKDAYS.indexOf(parts.get('weekday') ?? ''),
    hour: Number(parts.get('hour')),
    minute: Number(parts.get('minute')),
  };
}

/** Minutes between Paris and UTC at this instant: 60 in winter, 120 in summer. */
function parisOffsetMinutes(date: Date): number {
  const wall = parisParts(date);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const instantToTheMinute = Math.floor(date.getTime() / 60_000) * 60_000;
  return Math.round((wallAsUtc - instantToTheMinute) / 60_000);
}

const frenchFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: PARIS_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const frenchDayFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: PARIS_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "mercredi 7 octobre" — the Paris calendar day of an instant, as an email reads it. */
export function formatParisDate(value: string | Date): string {
  return frenchDayFormatter.format(new Date(value));
}

/** "mer. 30 sept. à 10:00" — an instant as a French notification reads it, on a Paris clock. */
export function formatParisDateTime(value: string | Date): string {
  const parts = new Map(frenchFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.get('weekday')} ${parts.get('day')} ${parts.get('month')} à ${parts.get('hour')}:${parts.get('minute')}`;
}

/**
 * The instant at which a Paris clock shows this date and time. `month` is
 * 1-based; an overflowing `day` rolls over like `Date.UTC`.
 */
export function parisTime(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wallAsUtc - parisOffsetMinutes(new Date(wallAsUtc)) * 60_000;
  // The offset at the guessed instant can differ on the two days the clocks
  // change; one correction settles it.
  return new Date(wallAsUtc - parisOffsetMinutes(new Date(firstGuess)) * 60_000);
}
