import { useState, useEffect, useRef } from 'react'

const POLL_MS = 2000

export function usePlanes() {
  const [planes, setPlanes] = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const res = await fetch('/data/aircraft.json', { cache: 'no-store' })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!active) return
        const visible = (data.aircraft || []).filter(
          (a) => a.lat != null && a.lon != null
        )
        setPlanes(visible)
        setLastUpdate(new Date())
        setError(false)
      } catch {
        if (active) setError(true)
      }
      if (active) timer.current = setTimeout(poll, POLL_MS)
    }

    poll()
    return () => {
      active = false
      clearTimeout(timer.current)
    }
  }, [])

  return { planes, lastUpdate, error }
}
