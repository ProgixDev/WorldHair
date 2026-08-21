import Mapbox, {
  Camera,
  MapView,
  MarkerView,
  UserLocation,
} from "@rnmapbox/maps";
import React, { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { MAPBOX_TOKEN } from "../../features/salons/mapProvider";
import { formatPrice } from "../../utils/date";
import type { MapCanvasProps } from "./MapCanvasTypes";

/**
 * Mapbox renderer. Vector tiles, so the map stays sharp at any zoom and the
 * dark/light styles come from Mapbox rather than a hand-written JSON.
 *
 * Requires a development build: the module is native, so it is absent from
 * Expo Go — `MapCanvas` picks the react-native-maps renderer there.
 */

// The public token is meant to ship inside the app; the secret download token
// stays a build-time secret in app.config.js.
if (MAPBOX_TOKEN) Mapbox.setAccessToken(MAPBOX_TOKEN);

export function MapCanvasMapbox({
  salons,
  center,
  selectedId = null,
  onSelect,
  showsUserLocation = false,
  interactive = true,
  style,
  focusCenter = false,
}: MapCanvasProps) {
  const { theme, themeMode } = useTheme();
  const cameraRef = useRef<Camera>(null);

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && theme.background.dark.startsWith("#0"));

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    if (focusCenter) {
      camera.setCamera({
        centerCoordinate: [center.longitude, center.latitude],
        zoomLevel: 14,
        animationDuration: 400,
      });
      return;
    }

    const selected = salons.find((salon) => salon.id === selectedId);
    if (selected) {
      camera.setCamera({
        centerCoordinate: [selected.longitude, selected.latitude],
        zoomLevel: 14.5,
        animationDuration: 450,
      });
      return;
    }

    if (salons.length === 0) {
      camera.setCamera({
        centerCoordinate: [center.longitude, center.latitude],
        zoomLevel: 11,
        animationDuration: 400,
      });
      return;
    }

    // Frame every pin plus the user's position, with a margin so nothing sits
    // under the floating header or the carousel.
    const lats = salons.map((salon) => salon.latitude).concat(center.latitude);
    const lons = salons
      .map((salon) => salon.longitude)
      .concat(center.longitude);
    camera.fitBounds(
      [Math.max(...lons), Math.max(...lats)],
      [Math.min(...lons), Math.min(...lats)],
      [140, 60, 220, 60],
      500,
    );
  }, [salons, selectedId, center, focusCenter]);

  return (
    <View style={[{ flex: 1, overflow: "hidden" }, style]}>
      <MapView
        style={{ flex: 1 }}
        styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Light}
        scaleBarEnabled={false}
        compassEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        // Mapbox terms require the logo and attribution to stay visible.
        logoPosition={{ bottom: 6, left: 6 }}
        attributionPosition={{ bottom: 6, left: 88 }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [center.longitude, center.latitude],
            zoomLevel: focusCenter ? 14 : 11,
          }}
        />

        {showsUserLocation ? (
          <UserLocation visible androidRenderMode="normal" />
        ) : null}

        {salons.map((salon) => {
          const selected = salon.id === selectedId;
          return (
            <MarkerView
              key={salon.id}
              id={salon.id}
              coordinate={[salon.longitude, salon.latitude]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap={selected}
            >
              <Pressable
                onPress={() => onSelect?.(salon.id)}
                accessibilityRole="button"
                accessibilityLabel={
                  salon.name + ", " + formatPrice(salon.priceFrom)
                }
                style={{ alignItems: "center" }}
              >
                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: radius.full,
                    backgroundColor: selected
                      ? theme.primary.main
                      : theme.surface.raised,
                    borderWidth: 1,
                    borderColor: selected ? theme.primary.main : theme.border,
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: selected
                          ? theme.primary.on
                          : theme.foreground.white,
                      },
                    ]}
                  >
                    {formatPrice(salon.priceFrom)}
                  </Text>
                </View>
                <View
                  style={{
                    width: 2,
                    height: 8,
                    backgroundColor: selected
                      ? theme.primary.main
                      : theme.border,
                  }}
                />
              </Pressable>
            </MarkerView>
          );
        })}
      </MapView>
    </View>
  );
}
