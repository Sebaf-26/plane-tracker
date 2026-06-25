import { useState } from 'react'
import { formatAlt, formatSpeed, formatDist, haversineKm } from '../utils'
import { getSpecial, iconPath, MDI } from '../specialCallsigns'

const HELI_CAT = new Set(['B1', 'B2', 'A7'])

function isHelicopter(p) {
  const sp = getSpecial(p.flight)
  if (sp && sp.icon === 'helicopter') return true
  return HELI_CAT.has(p.category)
}

function PlaneRow({ p, selected, onSelect, receiverLat, receiverLon, historical }) {
  const callsign  = p.flight?.trim() || p.hex.toUpperCase()
  const dist      = haversineKm(receiverLat, receiverLon, p.lat, p.lon)
  const isSelected = p.hex === selected
  const special   = getSpecial(p.flight)
  const heli      = isHelicopter(p)

  const color = isSelected ? 'var(--accent)'
    : historical ? 'var(--text3)'
    : special ? special.color
    : 'var(--text)'

  const iconFill = historical ? '#666'
    : isSelected ? 'var(--accent)'
    : special ? special.color
    : '#fac123'

  const bgBadge = isSelected ? 'var(--accent)'
    : historical ? 'rgba(120,120,120,0.25)'
    : special ? `${special.color}22`
    : 'rgba(250,193,35,0.15)'

  const borderBadge = special && !historical
    ? `${special.color}44`
    : isSelected ? 'rgba(250,193,35,0.5)'
    : 'rgba(255,255,255,0.06)'

  const path = iconPath(special, heli)

  return (
    <div
      onClick={() => onSelect(p.hex)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--r-lg)',
        background: isSelected ? 'var(--accent-dim)' : 'var(--card-inner)',
        border: `1px solid ${isSelected ? 'rgba(250,193,35,0.35)' : special && !historical ? `${special.color}33` : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        opacity: historical ? 0.55 : 1,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: bgBadge,
        border: `1.5px solid ${borderBadge}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
          <path d={path} fill={iconFill} />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {callsign}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          {historical
            ? <span style={{ fontStyle: 'italic' }}>storico</span>
            : special
            ? <span style={{ color: special.color, fontWeight: 600 }}>{special.label}</span>
            : <>{formatAlt(p.alt_baro)} · {formatSpeed(p.gs)}</>}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
        {formatDist(dist)}
      </div>
    </div>
  )
}

function SearchBar({ value, onChange }) {
  return (
    <div style={{ padding: '12px 16px 4px', position: 'relative' }}>
      <svg
        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15"
        style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <path fill="var(--text3)" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Cerca volo… (es. RYR1231)"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '9px 32px 9px 34px',
          background: 'var(--card-inner)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--r-lg)',
          color: 'var(--text)',
          fontSize: 13,
          outline: 'none',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: 16, lineHeight: 1, padding: 2,
          }}
        >×</button>
      )}
    </div>
  )
}

export default function FlightList({ planes, historicalPlanes = [], selected, onSelect, receiverLat, receiverLon }) {
  const [query, setQuery] = useState('')

  const q = query.trim().toUpperCase()

  const filterPlane = (p) => {
    if (!q) return true
    const callsign = (p.flight?.trim() || p.hex).toUpperCase()
    return callsign.includes(q) || p.hex.toUpperCase().includes(q)
  }

  const sorted = [...planes]
    .filter(filterPlane)
    .sort((a, b) =>
      haversineKm(receiverLat, receiverLon, a.lat, a.lon) -
      haversineKm(receiverLat, receiverLon, b.lat, b.lon)
    )

  const sortedHistorical = [...historicalPlanes]
    .filter(filterPlane)
    .sort((a, b) => (b.last_seen ?? 0) - (a.last_seen ?? 0))

  const noResults = sorted.length === 0 && sortedHistorical.length === 0

  return (
    <>
      <SearchBar value={query} onChange={setQuery} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 16px 16px' }}>
        {noResults && (
          <div style={{ padding: '24px 16px', color: 'var(--text2)', fontSize: 14, textAlign: 'center' }}>
            {q ? `Nessun volo trovato per "${q}".` : 'Nessun volo visibile al momento.'}
          </div>
        )}
        {sorted.map((p) => (
          <PlaneRow key={p.hex} p={p} selected={selected} onSelect={onSelect}
            receiverLat={receiverLat} receiverLon={receiverLon} historical={false} />
        ))}
        {sortedHistorical.length > 0 && sorted.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 0.8, padding: '8px 2px 2px', textTransform: 'uppercase', fontWeight: 600 }}>
            Storico recente
          </div>
        )}
        {sortedHistorical.map((p) => (
          <PlaneRow key={`h-${p.hex}`} p={p} selected={selected} onSelect={onSelect}
            receiverLat={receiverLat} receiverLon={receiverLon} historical={true} />
        ))}
      </div>
    </>
  )
}
