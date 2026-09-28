/**
 * "4,8" — the salon's average, computed server-side from its real reviews —
 * or `null` before the first review, which the UI shows as "Nouveau"
 * rather than a misleading "0,0".
 */
export function ratingLabel(salon: { rating: number; reviewCount: number }): string | null {
  if (salon.reviewCount === 0) return null;
  return salon.rating.toFixed(1).replace(".", ",");
}
