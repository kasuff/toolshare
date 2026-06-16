export function formatOfferDistance(distance: number | null) {
  return distance === null ? "Distanz offen" : `${distance.toFixed(1)} km`;
}
