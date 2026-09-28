import type { StyleProp, ViewStyle } from "react-native";
import type { MapBounds } from "../../features/salons/filters";
import type { Coordinates } from "../../features/salons/geo";
import type { SalonWithDistance } from "../../features/salons/types";

/** Contract every map engine implements, so screens never know which one runs. */
export interface MapCanvasProps {
  salons: SalonWithDistance[];
  center: Coordinates;
  selectedId?: string | null;
  onSelect?: (salonId: string) => void;
  showsUserLocation?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Keeps the camera on `center` instead of framing every salon. */
  focusCenter?: boolean;
  /** The client moved the map and it settled: the area it now shows, to search in. */
  onAreaChange?: (bounds: MapBounds) => void;
  /**
   * When given, salons are framed only when it changes (a new position or
   * search) — not each time the area's salons come back, which would move
   * the map under the client's finger.
   */
  fitKey?: string;
}
