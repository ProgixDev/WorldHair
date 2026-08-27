import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

import {
  ACTION_COUNT_KEY,
  ensureFirstOpenRecorded,
  FIRST_OPEN_AT_KEY,
  PROMPTED_KEY,
  recordEngagementAction,
} from "./reviewPrompt";

const mockedIsAvailableAsync = StoreReview.isAvailableAsync as jest.Mock;
const mockedRequestReview = StoreReview.requestReview as jest.Mock;

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_OPEN = new Date("2026-01-01T00:00:00.000Z").getTime();

describe("reviewPrompt", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockedIsAvailableAsync.mockClear();
    mockedRequestReview.mockClear();
    mockedIsAvailableAsync.mockResolvedValue(true);
    mockedRequestReview.mockResolvedValue(undefined);
  });

  describe("ensureFirstOpenRecorded", () => {
    it("writes the timestamp on the first call", async () => {
      await ensureFirstOpenRecorded(FIRST_OPEN);

      expect(await AsyncStorage.getItem(FIRST_OPEN_AT_KEY)).toBe(
        new Date(FIRST_OPEN).toISOString(),
      );
    });

    it("never overwrites an existing timestamp", async () => {
      await ensureFirstOpenRecorded(FIRST_OPEN);
      await ensureFirstOpenRecorded(FIRST_OPEN + DAY_MS);

      expect(await AsyncStorage.getItem(FIRST_OPEN_AT_KEY)).toBe(
        new Date(FIRST_OPEN).toISOString(),
      );
    });
  });

  describe("recordEngagementAction", () => {
    it("does not count an action taken before the 3-day mark", async () => {
      await ensureFirstOpenRecorded(FIRST_OPEN);

      await recordEngagementAction(FIRST_OPEN + 2 * DAY_MS);

      expect(await AsyncStorage.getItem(ACTION_COUNT_KEY)).toBeNull();
      expect(mockedRequestReview).not.toHaveBeenCalled();
    });

    it("starts counting once the 3-day mark has passed", async () => {
      await ensureFirstOpenRecorded(FIRST_OPEN);

      await recordEngagementAction(FIRST_OPEN + 3 * DAY_MS);

      expect(await AsyncStorage.getItem(ACTION_COUNT_KEY)).toBe("1");
    });

    it("does not prompt before the 5th post-day-3 action", async () => {
      await ensureFirstOpenRecorded(FIRST_OPEN);
      const after = FIRST_OPEN + 3 * DAY_MS;

      for (let i = 0; i < 4; i++) {
        await recordEngagementAction(after);
      }

      expect(await AsyncStorage.getItem(ACTION_COUNT_KEY)).toBe("4");
      expect(mockedRequestReview).not.toHaveBeenCalled();
    });

    it("prompts on exactly the 5th post-day-3 action", async () => {
      await ensureFirstOpenRecorded(FIRST_OPEN);
      const after = FIRST_OPEN + 3 * DAY_MS;

      for (let i = 0; i < 5; i++) {
        await recordEngagementAction(after);
      }

      expect(mockedRequestReview).toHaveBeenCalledTimes(1);
      expect(await AsyncStorage.getItem(PROMPTED_KEY)).toBe("true");
    });

    it("never prompts twice, even with many more actions afterwards", async () => {
      await ensureFirstOpenRecorded(FIRST_OPEN);
      const after = FIRST_OPEN + 3 * DAY_MS;

      for (let i = 0; i < 8; i++) {
        await recordEngagementAction(after);
      }

      expect(mockedRequestReview).toHaveBeenCalledTimes(1);
    });

    it("does not call requestReview when the native API is unavailable", async () => {
      mockedIsAvailableAsync.mockResolvedValue(false);
      await ensureFirstOpenRecorded(FIRST_OPEN);
      const after = FIRST_OPEN + 3 * DAY_MS;

      for (let i = 0; i < 5; i++) {
        await recordEngagementAction(after);
      }

      expect(mockedRequestReview).not.toHaveBeenCalled();
      // Still marked prompted — we don't retry every future action once the
      // threshold has been reached once.
      expect(await AsyncStorage.getItem(PROMPTED_KEY)).toBe("true");
    });

    it("a batched action still counts as exactly one", async () => {
      await ensureFirstOpenRecorded(FIRST_OPEN);
      const after = FIRST_OPEN + 3 * DAY_MS;

      // One call represents one meaningful action, however much work it did
      // under the hood — the caller decides what counts as "one" by how
      // often it calls this.
      await recordEngagementAction(after);

      expect(await AsyncStorage.getItem(ACTION_COUNT_KEY)).toBe("1");
    });
  });
});
