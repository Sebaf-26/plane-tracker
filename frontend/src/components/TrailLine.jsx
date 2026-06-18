import { Polyline } from 'react-leaflet'
import { splitSessions, SESSION_COLORS } from '../sessions'

const SEGMENTS = 6

export default function TrailLine({ points, selected }) {
  if (!points || points.length < 2) return null

  const sessions = splitSessions(points)

  return <>
    {sessions.map((session, si) => {
      if (session.length < 2) return null
      const color = selected ? SESSION_COLORS[si % SESSION_COLORS.length] : '#fac123'
      const size = Math.ceil(session.length / SEGMENTS)

      return Array.from({ length: SEGMENTS }, (_, i) => {
        const start = Math.max(0, session.length - (i + 1) * size)
        const end   = session.length - i * size
        const chunk = session.slice(start, end + 1)
        if (chunk.length < 2) return null

        const opacity = selected
          ? 0.85 - i * 0.12
          : 0.7  - i * 0.10

        return (
          <Polyline
            key={`${si}-${i}`}
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
      })
    })}
  </>
}
