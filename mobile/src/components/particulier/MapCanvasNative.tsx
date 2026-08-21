import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, UrlTile } from "react-native-maps";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { regionForSalons } from "../../features/salons/geo";
import {
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  USE_OSM_TILES,
} from "../../features/salons/mapProvider";
import {
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
} from "../../features/salons/mapStyle";
import { formatPrice } from "../../utils/date";

import type { MapCanvasProps } from "./MapCanvasTypes";

/**
 * Native map with price pins.
 *
 * - iOS: Apple Maps, no key needed.
 * - Android with a Google key (or inside Expo Go): Google Maps, themed.
 * - Android without a key: the Google base layer is disabled and
 *   OpenStreetMap raster tiles are drawn instead, so the map still works
 *   rather than rendering the classic grey rectangle.
 */
export function MapCanvasNative({
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
  const mapRef = useRef<MapView>(null);

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && theme.background.dark.startsWith("#0"));

  // Frame everything on first paint, then follow the selected pin.
  useEffect(() => {
    if (!mapRef.current) return;
    if (focusCenter) {
      mapRef.current.animateToRegion(
        { ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        400,
      );
      return;
    }
    const selected = salons.find((salon) => salon.id === selectedId);
    if (selected) {
      mapRef.current.animateToRegion(
        {
          latitude: selected.latitude,
          longitude: selected.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        450,
      );
      return;
    }
    mapRef.current.animateToRegion(regionForSalons(salons, center), 500);
  }, [selectedId, salons, center, focusCenter]);

  return (
    <View style={[{ flex: 1, overflow: "hidden" }, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        // "none" hides Google's own tiles so the OSM overlay is what shows.
        mapType={USE_OSM_TILES ? "none" : "standard"}
        customMapStyle={isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        initialRegion={
          focusCenter
            ? { ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : regionForSalons(salons, center)
        }
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {USE_OSM_TILES ? (
          <UrlTile
            urlTemplate={OSM_TILE_URL}
            maximumZ={19}
            tileSize={256}
            zIndex={-1}
            shouldReplaceMapContent
          />
        ) : null}

        {salons.map((salon) => {
          const selected = salon.id === selectedId;
          return (
            <Marker
              key={salon.id}
              coordinate={{
                latitude: salon.latitude,
                longitude: salon.longitude,
              }}
              onPress={() => onSelect?.(salon.id)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 4,
                    borderRadius: radius.full,
                    backgroundColor: selected
                      ? theme.primary.main
                      : theme.surface.base,
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
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* OSM tile usage requires visible attribution. */}
      {USE_OSM_TILES ? (
        <View
          style={{
            position: "absolute",
            right: 4,
            bottom: 4,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: radius.sm,
            backgroundColor: theme.surface.glass,
          }}
          pointerEvents="none"
        >
          <Text
            style={[
              typography.caption,
              { fontSize: 9, color: theme.foreground.gray },
            ]}
          >
            {OSM_ATTRIBUTION}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
