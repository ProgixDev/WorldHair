import React, { useMemo } from "react";
import { View } from "react-native";
import { qrRuns } from "../../features/pro/qr";

/** Blank modules around the code: scanners need them to find its edges. */
const QUIET_ZONE = 4;

/**
 * A QR code drawn with plain views (features/pro/qr.ts) — black on white
 * whatever the app's theme, as phone cameras expect.
 */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const { size: modules, runs } = useMemo(() => qrRuns(value), [value]);
  const cell = size / (modules + QUIET_ZONE * 2);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="QR code à scanner"
      style={{ width: size, height: size, backgroundColor: "#ffffff", borderRadius: 12 }}
    >
      {runs.map((run) => (
        <View
          key={run.row + ":" + run.col}
          style={{
            position: "absolute",
            top: (run.row + QUIET_ZONE) * cell,
            left: (run.col + QUIET_ZONE) * cell,
            // A hair wider and taller: no white seams between neighbouring modules.
            width: run.length * cell + 0.5,
            height: cell + 0.5,
            backgroundColor: "#000000",
          }}
        />
      ))}
    </View>
  );
}
