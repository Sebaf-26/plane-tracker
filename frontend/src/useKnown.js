import { useState, useEffect } from 'react'

export function useKnown() {
  const [known, setKnown] = useState([])

  useEffect(() => {
    let active = true
    async function fetch_() {
      try {
        const r = await fetch('/api/known')
        if (r.ok && active) setKnown(await r.json())
      } catch {}
    }
    fetch_()
    const t = setInterval(fetch_, 30000)
    return () => { active = false; clearInterval(t) }
  }, [])

  return known
}
