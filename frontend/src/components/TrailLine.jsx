import { Polyline } from 'react-leaflet'

// Divide il trail in N segmenti con opacità decrescente verso la coda
const SEGMENTS = 6

export default function TrailLine({ points, selected }) {
  if (!points || points.length < 2) return null

  const color = selected ? '#0a84ff' : '#fac123'
  const size = Math.ceil(points.length / SEGMENTS)
  const segments = []

  for (let i = 0; i < SEGMENTS; i++) {
    const start = Math.max(0, points.length - (i + 1) * size)
    const end   = points.length - i * size
    const chunk = points.slice(start, end + 1)  // +1 per overlap tra segmenti
    if (chunk.length < 2) continue

    const opacity = selected
      ? 0.85 - i * 0.12
      : 0.7  - i * 0.10

    segments.push(
      <Polyline
        key={i}
        positions={chunk.map((p) => [p.lat, p.lon])}
        pathOptions={{
          color,
          weight: selected ? 2 : 1.5,
          opacity: Math.max(opacity, 0.05),
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    )
  }

  return <>{segments}</>
}
