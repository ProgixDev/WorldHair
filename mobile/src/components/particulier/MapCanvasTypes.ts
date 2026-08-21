import type { StyleProp, ViewStyle } from "react-native";
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
}
