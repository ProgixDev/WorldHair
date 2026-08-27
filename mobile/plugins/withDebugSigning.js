const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Pins the debug signingConfig to a stable keystore outside `android/`.
 *
 * The stock template points `signingConfigs.debug.storeFile` at a relative
 * `debug.keystore` living inside `android/app/` — but `android/` is wiped
 * wholesale by `expo prebuild --clean` (see `withReleaseSigning.js` for the
 * same constraint), and that file is not tracked in git. Every `--clean`
 * therefore leaves it missing, and Gradle/AGP silently mints a brand new
 * keystore with a brand new random key the next time it's needed — which
 * changes the debug SHA-1 fingerprint and breaks the Google OAuth debug
 * client, since it was registered against the previous, now-gone key.
 *
 * `mobile/keystores/debug.keystore` is a committed, stable file (see
 * .gitignore — it's the one exception in that folder, since debug keystores
 * use the well-known androiddebugkey/android credentials and are not a
 * secret) that this plugin points the build at instead, so the SHA-1 never
 * changes again regardless of how many times android/ gets regenerated.
 */
module.exports = function withDebugSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    const marker = "storeFile file('debug.keystore')";
    const replacement = "storeFile file('../../keystores/debug.keystore')";

    if (contents.includes(replacement)) {
      return config;
    }

    if (!contents.includes(marker)) {
      throw new Error(
        "withDebugSigning: expected build.gradle shape not found — the Expo prebuild template changed. Update the marker in mobile/plugins/withDebugSigning.js.",
      );
    }

    config.modResults.contents = contents.replace(marker, replacement);

    return config;
  });
};
