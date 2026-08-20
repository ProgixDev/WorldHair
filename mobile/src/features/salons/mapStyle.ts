/**
 * Google Maps styling (Android; iOS falls back to Apple Maps defaults).
 * Two variants so the map never fights the app theme.
 */

export const MAP_STYLE_DARK = [
  { elementType: "geometry", stylers: [{ color: "#0f1d30" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ba3b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1626" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#152a44" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#1c3350" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#071223" }],
  },
];

export const MAP_STYLE_LIGHT = [
  { elementType: "geometry", stylers: [{ color: "#f2f4f7" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b7186" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#cfe0ef" }],
  },
];
