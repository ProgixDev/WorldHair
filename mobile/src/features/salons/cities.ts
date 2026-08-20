import type { Coordinates } from "./geo";

export interface City extends Coordinates {
  id: string;
  label: string;
}

/** Manual fallback when the user refuses GPS ("Choisir une ville"). */
export const CITIES: City[] = [
  { id: "paris", label: "Paris", latitude: 48.8566, longitude: 2.3522 },
  { id: "lyon", label: "Lyon", latitude: 45.764, longitude: 4.8357 },
  { id: "marseille", label: "Marseille", latitude: 43.2965, longitude: 5.3698 },
  { id: "bordeaux", label: "Bordeaux", latitude: 44.8378, longitude: -0.5792 },
  { id: "lille", label: "Lille", latitude: 50.6292, longitude: 3.0573 },
  { id: "toulouse", label: "Toulouse", latitude: 43.6047, longitude: 1.4442 },
  { id: "nantes", label: "Nantes", latitude: 47.2184, longitude: -1.5536 },
  {
    id: "strasbourg",
    label: "Strasbourg",
    latitude: 48.5734,
    longitude: 7.7521,
  },
];
