const { AndroidConfig, withAndroidStyles } = require("expo/config-plugins");

/**
 * Forces a transparent, non-contrast-scrimmed Android status bar on AppTheme,
 * so the app draws edge-to-edge under it.
 *
 * The competing writer is `withStatusBar` from @expo/config-plugins
 * (build/android/StatusBar.js) — NOT expo-splash-screen, which never touches
 * `statusBarColor`. With no `androidStatusBar` key in app.json, withStatusBar
 * computes `add: floatElement || !!hexString` → false and therefore REMOVES
 * `android:statusBarColor`. Once removed, Theme.AppCompat.DayNight falls back
 * to `?attr/colorPrimaryDark`, which res/values/colors.xml defines as #F5F5F5
 * — a light bar over a dark app.
 *
 * Ordering matters: `assignStylesValue` with `add: true` overwrites in place,
 * so the LAST withAndroidStyles mod to touch an attribute wins, silently. The
 * constraint is against the core prebuild mod pipeline — this plugin has to run
 * after core's withStatusBar, or it no-ops with no warning. The `plugins` array
 * in app.json is not the lever for that: withStatusBar is not listed there, and
 * the sibling that is (withTransparentNavigationBar) writes a disjoint
 * attribute, so their relative order is irrelevant.
 */
const VALUES = [
  ["android:statusBarColor", "@android:color/transparent"],
  ["android:enforceStatusBarContrast", "false"],
];

module.exports = function withTransparentStatusBar(config) {
  return withAndroidStyles(config, (config) => {
    for (const [name, value] of VALUES) {
      config.modResults = AndroidConfig.Styles.assignStylesValue(
        config.modResults,
        {
          add: true,
          parent: AndroidConfig.Styles.getAppThemeGroup(),
          name,
          value,
        },
      );
    }
    return config;
  });
};
