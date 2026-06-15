import { useState, useEffect, useRef } from 'react'

// Trail in-memory per smoothness realtime (punti non ancora in DB)
const MAX_POINTS = 60
const DB_POLL_MS = 5000

export function useTrails(planes, selectedHex) {
  const memory = useRef({})            // hex -> [{lat, lon, ts}]  (realtime)
  const [dbTrail, setDbTrail] = useState([])  // trail del selezionato dal DB

  // Aggiorna memory trail ad ogni aggiornamento planes
  useEffect(() => {
    const now = Date.now()
    const seen = new Set(planes.map((p) => p.hex))

    for (const hex of Object.keys(memory.current)) {
      if (!seen.has(hex)) delete memory.current[hex]
    }

    for (const p of planes) {
      if (p.lat == null || p.lon == null) continue
      const prev = memory.current[p.hex] ?? []
      const last = prev[prev.length - 1]
      if (last && last.lat === p.lat && last.lon === p.lon) continue
      memory.current[p.hex] = [...prev, { lat: p.lat, lon: p.lon, ts: now }].slice(-MAX_POINTS)
    }
  }, [planes])

  // Fetch trail dal DB per l'aereo selezionato
  useEffect(() => {
    if (!selectedHex) { setDbTrail([]); return }

    let active = true
    async function fetchTrail() {
      try {
        const r = await fetch(`/api/trail/${selectedHex}`)
        if (!r.ok) return
        const pts = await r.json()
        if (active) setDbTrail(pts)
      } catch {}
    }

    fetchTrail()
    const timer = setInterval(fetchTrail, DB_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [selectedHex])

  // Per ogni aereo: usa DB trail se selezionato, altrimenti memory
  function getTrail(hex) {
    if (hex === selectedHex && dbTrail.length > 0) return dbTrail
    return memory.current[hex] ?? []
  }

  return { getTrail }
}
