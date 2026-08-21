/**
 * Layers environment values on top of app.json.
 * Expo CLI loads `.env` automatically before evaluating this file.
 *
 * Mapbox:
 * - EXPO_PUBLIC_MAPBOX_PK (pk.*) is read at runtime, inlined by Expo.
 * - RNMAPBOX_MAPS_DOWNLOAD_TOKEN (sk.*, scope DOWNLOADS:READ) is read straight
 *   from the environment by the @rnmapbox/maps plugin at build time. Do not
 *   pass RNMapboxMapsDownloadToken: the plugin deprecated it.
 *
 * Google Maps stays optional: without GOOGLE_MAPS_API_KEY the app falls back
 * to OpenStreetMap tiles on Android instead of rendering a grey map.
 */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    // `android.config` is stripped from the public manifest, so the app cannot
    // read the key itself — it only needs to know whether one exists.
    googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
  },
  plugins: [...(config.plugins ?? []), "@rnmapbox/maps"],
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey:
          process.env.GOOGLE_MAPS_API_KEY ??
          config.android?.config?.googleMaps?.apiKey,
      },
    },
  },
});
