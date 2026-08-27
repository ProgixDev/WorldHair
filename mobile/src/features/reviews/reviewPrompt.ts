import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

/**
 * Local, per-install state for the review prompt — never synced to a server.
 */
export const FIRST_OPEN_AT_KEY = "@review_first_open_at";
export const ACTION_COUNT_KEY = "@review_action_count";
export const PROMPTED_KEY = "@review_prompted";

const COUNTING_STARTS_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const ACTION_THRESHOLD = 5;

/**
 * Anchors the 3-day gate. Call once on every cold start (e.g. from the root
 * layout) — it only ever writes once, the first call wins for the lifetime
 * of the install.
 */
export async function ensureFirstOpenRecorded(now: number = Date.now()): Promise<void> {
  const existing = await AsyncStorage.getItem(FIRST_OPEN_AT_KEY);
  if (existing !== null) {
    return;
  }
  await AsyncStorage.setItem(FIRST_OPEN_AT_KEY, new Date(now).toISOString());
}

/**
 * Call after whatever "meaningful action" the app wants to gate the review
 * prompt on (a completed purchase, a saved item, a finished task — pick one
 * that signals genuine engagement). Counts towards the prompt only once the
 * 3-day grace period has fully elapsed — actions taken before that are not
 * counted at all, not deferred, so a same-day burst of activity can never
 * front-load the counter. One call here is always exactly one count; the
 * caller decides what counts as "one action" by how often it calls this.
 */
export async function recordEngagementAction(now: number = Date.now()): Promise<void> {
  const alreadyPrompted = await AsyncStorage.getItem(PROMPTED_KEY);
  if (alreadyPrompted === "true") {
    return;
  }

  const firstOpenAtRaw = await AsyncStorage.getItem(FIRST_OPEN_AT_KEY);
  if (firstOpenAtRaw === null) {
    // No anchor yet — shouldn't happen once `ensureFirstOpenRecorded` has run
    // on this launch, but with no anchor there's nothing to gate against.
    return;
  }

  const firstOpenAt = new Date(firstOpenAtRaw).getTime();
  if (now - firstOpenAt < COUNTING_STARTS_AFTER_MS) {
    return;
  }

  const countRaw = await AsyncStorage.getItem(ACTION_COUNT_KEY);
  const nextCount = (countRaw === null ? 0 : Number.parseInt(countRaw, 10)) + 1;
  await AsyncStorage.setItem(ACTION_COUNT_KEY, String(nextCount));

  if (nextCount < ACTION_THRESHOLD) {
    return;
  }

  // Set before the native call, not after: if `requestReview` throws, we
  // still don't want to retry on the next action — one attempt is enough.
  await AsyncStorage.setItem(PROMPTED_KEY, "true");
  try {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
  } catch {
    // Best-effort — a failed native call must not surface to the user.
  }
}
