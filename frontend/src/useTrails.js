import { useRef, useCallback } from 'react'

const MAX_POINTS = 120  // ~4 minuti a 2s di polling

export function useTrails() {
  const trails = useRef({})  // hex -> [{lat, lon, t}]

  const update = useCallback((planes) => {
    const now = Date.now()
    const seen = new Set(planes.map((p) => p.hex))

    // Rimuovi aerei scomparsi
    for (const hex of Object.keys(trails.current)) {
      if (!seen.has(hex)) delete trails.current[hex]
    }

    // Aggiungi nuovi punti
    for (const p of planes) {
      if (p.lat == null || p.lon == null) continue
      const prev = trails.current[p.hex] ?? []
      const last = prev[prev.length - 1]
      // Evita duplicati se la posizione non è cambiata
      if (last && last.lat === p.lat && last.lon === p.lon) continue
      trails.current[p.hex] = [...prev, { lat: p.lat, lon: p.lon, t: now }].slice(-MAX_POINTS)
    }

    return trails.current
  }, [])

  return { update, trails }
}
