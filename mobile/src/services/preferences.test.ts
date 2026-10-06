import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearPendingPresenceCode,
  clearPreferences,
  getPendingPresenceCode,
  setPendingPresenceCode,
} from "./preferences";

jest.mock("../lib/apiClient", () => ({ apiClient: {} }));

describe("pending presence code (« code de fin » scanned while signed out)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("keeps the code until it is handled, then forgets it", async () => {
    expect(await getPendingPresenceCode()).toBeNull();
    await setPendingPresenceCode("K7M2QX9D4H8W");
    expect(await getPendingPresenceCode()).toBe("K7M2QX9D4H8W");
    await clearPendingPresenceCode();
    expect(await getPendingPresenceCode()).toBeNull();
  });

  it("is wiped along with the other preferences", async () => {
    await setPendingPresenceCode("K7M2QX9D4H8W");
    await clearPreferences();
    expect(await getPendingPresenceCode()).toBeNull();
  });
});
