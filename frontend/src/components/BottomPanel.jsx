import { useEffect, useRef } from 'react'
import HistoryChart from './HistoryChart'
import { squawkInfo } from '../squawk'
import { formatAlt, formatAltSub, formatSpeed, formatSpeedSub } from '../utils'

export default function BottomPanel({ plane, sessionId, onClose }) {
  const ref = useRef(null)

  // Impedisce che i click sul pannello propaghino alla mappa
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stop = (e) => e.stopPropagation()
    el.addEventListener('click', stop)
    el.addEventListener('wheel', stop)
    return () => { el.removeEventListener('click', stop); el.removeEventListener('wheel', stop) }
  }, [])

  if (!plane) return null

  const callsign = plane.flight?.trim() || plane.hex.toUpperCase()
  const sqInfo = squawkInfo(plane.squawk)
  const baroRate = plane.baro_rate ?? plane.geom_rate

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(5,10,18,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.10)',
        padding: '14px 20px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Callsign */}
          <div>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{callsign}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>
              {plane.hex.toUpperCase()}
            </span>
            {plane.squawk && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 600,
                color: sqInfo ? sqInfo.color : 'rgba(255,255,255,0.5)',
              }}>
                {sqInfo ? `${sqInfo.icon ?? ''} ${sqInfo.label}` : `SQK ${plane.squawk}`}
              </span>
            )}
          </div>

          {/* Quick stats pills */}
          {[
            { label: 'ALT', value: formatAlt(plane.alt_baro), sub: formatAltSub(plane.alt_baro) },
            { label: 'GS',  value: formatSpeed(plane.gs),     sub: formatSpeedSub(plane.gs) },
            { label: 'HDG', value: plane.track != null ? `${Math.round(plane.track)}°` : '—', sub: null },
            { label: baroRate > 0 ? '↑' : baroRate < 0 ? '↓' : 'RATE',
              value: baroRate != null ? `${Math.abs(Math.round(baroRate))} ft/min` : '—',
              sub: null,
              color: baroRate > 0 ? 'var(--green)' : baroRate < 0 ? '#ff9f0a' : null,
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.07)', borderRadius: 10,
              padding: '5px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</span>
              {sub && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{sub}</span>}
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 20,
          color: 'rgba(255,255,255,0.6)', width: 28, height: 28, cursor: 'pointer',
          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>×</button>
      </div>

      {/* Charts */}
      <HistoryChart hex={plane.hex} sessionId={sessionId} />
    </div>
  )
}
