import { useEffect, useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

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

export default function HistoryChart({ hex }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hex) return
    setLoading(true)
    fetch(`/api/history/${hex}`)
      .then((r) => r.json())
      .then((rows) => {
        // Deduplica per timestamp e normalizza
        const seen = new Set()
        const clean = []
        for (const r of rows) {
          if (seen.has(r.ts)) continue
          seen.add(r.ts)
          clean.push({
            ts: r.ts,
            time: fmt(r.ts),
            alt_ft: r.alt_baro != null ? Math.round(r.alt_baro) : null,
            alt_m:  r.alt_baro != null ? Math.round(r.alt_baro * 0.3048) : null,
            gs_kt:  r.gs != null ? Math.round(r.gs) : null,
            gs_kmh: r.gs != null ? Math.round(r.gs * 1.852) : null,
            baro_rate: r.baro_rate != null ? Math.round(r.baro_rate) : null,
          })
        }
        setData(clean)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [hex])

  if (loading) return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      Caricamento storico…
    </div>
  )

  if (!data.length) return (
    <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
      Nessun dato storico disponibile.
    </div>
  )

  return (
    <div style={{ marginTop: 16 }}>
      {/* Altitude chart */}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, letterSpacing: 0.5 }}>
        ALTITUDINE (ft / m)
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#fac123" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#fac123" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="alt_ft" name="Alt ft" stroke="#fac123" strokeWidth={1.5} fill="url(#altGrad)" dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Speed chart */}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, marginTop: 14, letterSpacing: 0.5 }}>
        VELOCITÀ (kt) · RATEO VERTICALE (ft/min)
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
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
          <Area yAxisId="gs" type="monotone" dataKey="gs_kt" name="GS kt" stroke="#64d2ff" strokeWidth={1.5} fill="url(#gsGrad)" dot={false} connectNulls />
          <Line yAxisId="rate" type="monotone" dataKey="baro_rate" name="Rateo ft/min" stroke="#30d158" strokeWidth={1} dot={false} connectNulls strokeDasharray="3 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
