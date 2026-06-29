import { useEffect, useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { SESSION_COLORS, GAP_S } from '../sessions'

function fmt(ts) {
  return new Date(ts * 1000).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(13,20,32,0.97)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 12, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value != null ? p.value.toLocaleString() : '—'}</strong>
        </div>
      ))}
    </div>
  )
}

function toNum(v) {
  if (v == null) return null
  const n = typeof v === 'string' ? parseFloat(v) : v
  return isFinite(n) ? n : null
}

// currentOnly=true → per aerei live: prende solo l'ultima sessione (dopo l'ultimo gap)
function buildChartData(rows, currentOnly) {
  let working = rows

  if (currentOnly && rows.length > 1) {
    // Trova l'ultimo gap — tutto ciò che viene dopo è la sessione corrente
    let lastGapIdx = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].ts - rows[i - 1].ts > GAP_S) {
        lastGapIdx = i
      }
    }
    if (lastGapIdx > 0) {
      working = rows.slice(lastGapIdx)
      console.log(`[HistoryChart] live: sessione corrente = ultimi ${working.length} punti (su ${rows.length} totali)`)
    } else {
      console.log(`[HistoryChart] live: nessun gap trovato, uso tutti i ${rows.length} punti`)
    }
  }

  const seen = new Set()
  const clean = []
  let prevTs = null

  for (const r of working) {
    if (seen.has(r.ts)) continue
    seen.add(r.ts)

    const alt  = toNum(r.alt_baro)
    const gs   = toNum(r.gs)
    const rate = toNum(r.baro_rate)

    // Anche nella sessione singola possono esserci micro-gap
    if (prevTs != null && r.ts - prevTs > GAP_S) {
      clean.push({ ts: r.ts, time: fmt(r.ts), _gap: true, alt_ft: null, alt_m: null, gs_kt: null, gs_kmh: null, baro_rate: null })
    }

    clean.push({
      ts: r.ts,
      time: fmt(r.ts),
      alt_ft:    alt  != null ? Math.round(alt)  : null,
      alt_m:     alt  != null ? Math.round(alt * 0.3048) : null,
      gs_kt:     gs   != null ? Math.round(gs)   : null,
      gs_kmh:    gs   != null ? Math.round(gs * 1.852) : null,
      baro_rate: rate != null ? Math.round(rate) : null,
    })
    prevTs = r.ts
  }

  console.log(`[HistoryChart] buildChartData: ${clean.length} punti pronti per Recharts`)
  return clean
}

export default function HistoryChart({ hex, sessionId }) {
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)

  // currentOnly=true quando è un aereo live senza sessionId specifico
  const currentOnly = !sessionId

  useEffect(() => {
    const key = sessionId ?? hex
    if (!key) return
    setLoading(true)
    const url = sessionId
      ? `/api/session/${sessionId}/history`
      : `/api/history/${hex}`
    console.log(`[HistoryChart] fetch → ${url} (currentOnly=${currentOnly})`)
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((rows) => {
        console.log(`[HistoryChart] ricevute ${rows.length} righe grezze`)
        setPoints(buildChartData(rows, currentOnly))
      })
      .catch((err) => {
        console.error(`[HistoryChart] errore:`, err)
        setPoints([])
      })
      .finally(() => setLoading(false))
  }, [hex, sessionId])

  if (loading) return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      Caricamento storico…
    </div>
  )

  if (!points.length) return (
    <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      Nessun dato storico disponibile.
    </div>
  )

  return (
    <div style={{ marginTop: 16 }}>
      {sessionId && (
        <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 0.5, marginBottom: 6, fontWeight: 600 }}>
          SESSIONE · {sessionId.toUpperCase()}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, letterSpacing: 0.5 }}>
        ALTITUDINE (ft / m)
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <ComposedChart data={points} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#fac123" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#fac123" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => v != null ? `${(v/1000).toFixed(0)}k` : ''} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="alt_ft" name="Alt ft" stroke="#fac123" strokeWidth={1.5} fill="url(#altGrad)" dot={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, marginTop: 14, letterSpacing: 0.5 }}>
        VELOCITÀ (kt) · RATEO VERTICALE (ft/min)
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <ComposedChart data={points} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#64d2ff" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#64d2ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="gs" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="rate" orientation="right" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area yAxisId="gs" type="monotone" dataKey="gs_kt" name="GS kt" stroke="#64d2ff" strokeWidth={1.5} fill="url(#gsGrad)" dot={false} connectNulls={false} />
          <Line yAxisId="rate" type="monotone" dataKey="baro_rate" name="Rateo ft/min" stroke="#30d158" strokeWidth={1} dot={false} connectNulls={false} strokeDasharray="3 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
