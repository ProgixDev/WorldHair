import "react-native-gesture-handler/jestSetup";

jest.mock("react-native-reanimated", () =>
  require("react-native-reanimated/mock"),
);

// Default `useFocusEffect`: runs the effect once on mount, mirroring the real
// hook's initial-focus behaviour. Real usage always sits inside expo-router's
// navigator, which provides the navigation context this hook needs — but a
// screen test that renders a component directly bypasses that navigator
// entirely, so the real implementation would throw "Couldn't find a
// navigation object." A test that needs to simulate a LATER focus event (not
// just the initial one) should override this mock locally with finer control.
//
// Spreads the real module first: overriding only `useFocusEffect` on the mock
// object (rather than starting from the actual exports) would leave every
// OTHER export of `@react-navigation/native` undefined for the whole suite —
// both `expo-router` and `@react-navigation/bottom-tabs` pull from this
// module internally.
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (effect: () => void) => {
    require("react").useEffect(effect, []);
  },
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-image", () => {
  const { Image } = require("react-native");
  return { Image };
});

jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

// Defaults describe the interesting path: the native review API is available
// and resolves cleanly. A suite exercising unavailability overrides
// `isAvailableAsync` itself — see reviewPrompt.test.ts.
jest.mock("expo-store-review", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  requestReview: jest.fn().mockResolvedValue(undefined),
}));
