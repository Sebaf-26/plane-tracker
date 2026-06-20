export function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatAlt(alt) {
  if (alt == null || alt === 'ground') return 'GND'
  return `${Math.round(alt).toLocaleString()} ft`
}

export function formatAltSub(alt) {
  if (alt == null || alt === 'ground') return null
  const m = Math.round(alt * 0.3048)
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

export function formatSpeed(gs) {
  if (gs == null) return '---'
  return `${Math.round(gs)} kt`
}

export function formatSpeedSub(gs) {
  if (gs == null) return null
  return `${Math.round(gs * 1.852)} km/h`
}

export function formatDist(km) {
  if (km == null) return '---'
  return `${Math.round(km)} km`
}

export function slantRangeKm(groundKm, altFt) {
  if (groundKm == null) return null
  const altKm = altFt != null && altFt !== 'ground' ? altFt * 0.0003048 : 0
  return Math.sqrt(groundKm ** 2 + altKm ** 2)
}
