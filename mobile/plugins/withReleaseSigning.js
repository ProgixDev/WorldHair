const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

/**
 * Wires a self-managed release keystore into the Android release build.
 *
 * `android/` is regenerated wholesale by `expo prebuild` — see the sibling
 * plugins in this folder for the same constraint. A hand-edited
 * `signingConfigs.release` block in `build.gradle` would not survive the next
 * `prebuild`, let alone `prebuild --clean`, so this has to run as a plugin
 * every time, not as a one-off edit.
 *
 * Reads four env vars, loaded by Expo CLI itself from `.env` (no
 * `EXPO_PUBLIC_` prefix — that prefix inlines a value into the CLIENT BUNDLE,
 * which a signing password must never do):
 *   RELEASE_STORE_FILE      — path to the .jks, relative to android/app/
 *                              (e.g. ../../keystores/release.jks)
 *   RELEASE_STORE_PASSWORD
 *   RELEASE_KEY_ALIAS
 *   RELEASE_KEY_PASSWORD
 *
 * Run `scripts/setup-android-keystores.ts` to generate the keystore and fill
 * these in automatically. Absent (e.g. CI without the secret, or a machine
 * that never ran that script), release silently falls back to
 * `signingConfigs.debug` — the same behavior the stock template ships with.
 * This plugin only ever ADDS a path, never removes the one that was already
 * there.
 */
module.exports = function withReleaseSigning(config) {
  config = withGradleProperties(config, (config) => {
    const values = {
      RELEASE_STORE_FILE: process.env.RELEASE_STORE_FILE,
      RELEASE_STORE_PASSWORD: process.env.RELEASE_STORE_PASSWORD,
      RELEASE_KEY_ALIAS: process.env.RELEASE_KEY_ALIAS,
      RELEASE_KEY_PASSWORD: process.env.RELEASE_KEY_PASSWORD,
    };

    for (const [key, value] of Object.entries(values)) {
      if (!value) continue;
      // Drop any stale entry from a previous prebuild before pushing the
      // current one — `gradle.properties` is regenerated fresh each run, but
      // this stays correct even if that ever changes.
      config.modResults = config.modResults.filter(
        (item) => !(item.type === "property" && item.key === key),
      );
      config.modResults.push({ type: "property", key, value });
    }

    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Idempotency: `expo prebuild` WITHOUT `--clean` re-runs mods against
    // whatever is already on disk, not a fresh copy of the stock template —
    // unlike `--clean`, which deletes android/ first. The second consecutive
    // run therefore sees THIS plugin's own prior output, not the original
    // markers below. Recognizing that and no-op'ing is what makes the plugin
    // safe to run repeatedly, which `expo prebuild` assumes every plugin is.
    const alreadyApplied = "    signingConfigs {\n        release {\n            if (project.hasProperty(";
    if (contents.includes(alreadyApplied)) {
      return config;
    }

    const signingConfigsMarker = "    signingConfigs {\n        debug {";
    const releaseBuildTypeMarker =
      "        release {\n            // Caution! In production, you need to generate your own keystore file.\n            // see https://reactnative.dev/docs/signed-apk-android.\n            signingConfig signingConfigs.debug";

    if (!contents.includes(signingConfigsMarker) || !contents.includes(releaseBuildTypeMarker)) {
      // Fail loudly, not silently: a template shape change (Expo/AGP bump)
      // that this string match misses would otherwise leave release builds
      // quietly signed with the debug key again, with nothing to say so.
      throw new Error(
        "withReleaseSigning: expected build.gradle shape not found — the Expo prebuild template changed. Update the markers in plugins/withReleaseSigning.js.",
      );
    }

    const releaseSigningBlock =
      "    signingConfigs {\n" +
      "        release {\n" +
      "            if (project.hasProperty('RELEASE_STORE_FILE')) {\n" +
      "                storeFile file(RELEASE_STORE_FILE)\n" +
      "                storePassword RELEASE_STORE_PASSWORD\n" +
      "                keyAlias RELEASE_KEY_ALIAS\n" +
      "                keyPassword RELEASE_KEY_PASSWORD\n" +
      "            }\n" +
      "        }\n" +
      "        debug {";

    const releaseBuildTypeReplacement =
      "        release {\n" +
      "            signingConfig project.hasProperty('RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug";

    config.modResults.contents = contents
      .replace(signingConfigsMarker, releaseSigningBlock)
      .replace(releaseBuildTypeMarker, releaseBuildTypeReplacement);

    return config;
  });

  return config;
};
