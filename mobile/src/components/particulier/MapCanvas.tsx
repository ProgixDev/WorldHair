import React from "react";
import { MAPBOX_ENABLED } from "../../features/salons/mapProvider";
import { MapCanvasNative } from "./MapCanvasNative";
import type { MapCanvasProps } from "./MapCanvasTypes";

/**
 * Picks the map engine at runtime:
 *
 * - Mapbox when a public token is configured and the build is native
 *   (`@rnmapbox/maps` is absent from Expo Go).
 * - react-native-maps otherwise — Apple Maps on iOS, Google on Android with a
 *   key, OpenStreetMap raster tiles without one.
 *
 * The require is lazy on purpose: pulling the Mapbox module into a build that
 * has no native side would throw at import time, before any fallback can run.
 */
export function MapCanvas(props: MapCanvasProps) {
  if (MAPBOX_ENABLED) {
    try {
      /* eslint-disable @typescript-eslint/no-require-imports --
         Must stay a lazy require: a static import would evaluate Mapbox's
         native bindings even in builds that do not ship them. */
      const { MapCanvasMapbox } =
        require("./MapCanvasMapbox") as typeof import("./MapCanvasMapbox");
      /* eslint-enable @typescript-eslint/no-require-imports */
      return <MapCanvasMapbox {...props} />;
    } catch (error) {
      // Native module missing (Expo Go, or a build made before the install).
      console.warn(
        "Mapbox unavailable, falling back to react-native-maps",
        error,
      );
    }
  }

  return <MapCanvasNative {...props} />;
}
