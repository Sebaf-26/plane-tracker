import { formatAlt, formatSpeed, formatDist, haversineKm } from '../utils'

// MDI paths
const MDI_AIRPLANE = 'M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z'
const MDI_HELICOPTER = 'M6,1H7V6H17V1H18V6H21V8H3V6H6V1M21,18.56C21,19.36 20.55,20.06 19.88,20.41L13,24V22H3A1,1 0 0,1 2,21V11H22V18.56M7,13V15H17V13H7Z'

function isPegaso(flight) {
  if (!flight) return false
  const f = flight.trim().toUpperCase()
  return f.startsWith('PEGASO') || f.startsWith('PGSO')
}

function isHelicopter(p) {
  return isPegaso(p.flight) || p.category === 'A7' || p.category === 'B2'
}

function PlaneRow({ p, selected, onSelect, receiverLat, receiverLon, historical }) {
  const callsign = p.flight?.trim() || p.hex.toUpperCase()
  const dist = haversineKm(receiverLat, receiverLon, p.lat, p.lon)
  const isSelected = p.hex === selected
  const pegaso = isPegaso(p.flight)
  const heli = isHelicopter(p)

  const iconColor = historical ? '#666' : isSelected ? '#000' : pegaso ? '#ff453a' : '#fac123'
  const bgColor = isSelected
    ? 'var(--accent)'
    : historical
    ? 'rgba(120,120,120,0.25)'
    : pegaso
    ? 'rgba(255,69,58,0.2)'
    : 'rgba(250,193,35,0.15)'
  const borderColor = isSelected
    ? 'rgba(250,193,35,0.35)'
    : pegaso && !historical
    ? 'rgba(255,69,58,0.25)'
    : 'transparent'

  return (
    <div
      onClick={() => onSelect(p.hex)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--r-lg)',
        background: isSelected ? 'var(--accent-dim)' : 'var(--card-inner)',
        border: `1px solid ${borderColor}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        opacity: historical ? 0.55 : 1,
      }}
    >
      {/* MDI icon badge */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: bgColor,
        border: `1.5px solid ${pegaso && !historical ? 'rgba(255,69,58,0.4)' : isSelected ? 'rgba(250,193,35,0.5)' : 'rgba(255,255,255,0.06)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
          <path d={heli ? MDI_HELICOPTER : MDI_AIRPLANE} fill={isSelected ? 'var(--accent)' : iconColor} />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: isSelected ? 'var(--accent)' : historical ? 'var(--text3)' : pegaso ? '#ff453a' : 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pegaso && !historical && <span style={{ marginRight: 4 }}>🚁</span>}
          {callsign}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          {historical
            ? <span style={{ fontStyle: 'italic' }}>storico</span>
            : <>{formatAlt(p.alt_baro)} · {formatSpeed(p.gs)}</>}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
        {formatDist(dist)}
      </div>
    </div>
  )
}

export default function FlightList({ planes, historicalPlanes = [], selected, onSelect, receiverLat, receiverLon }) {
  const sorted = [...planes].sort((a, b) =>
    haversineKm(receiverLat, receiverLon, a.lat, a.lon) -
    haversineKm(receiverLat, receiverLon, b.lat, b.lon)
  )

  const sortedHistorical = [...historicalPlanes].sort((a, b) =>
    (b.last_seen ?? 0) - (a.last_seen ?? 0)
  )

  if (sorted.length === 0 && sortedHistorical.length === 0) {
    return (
      <div style={{ padding: '24px 16px', color: 'var(--text2)', fontSize: 14, textAlign: 'center' }}>
        Nessun volo visibile al momento.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px 16px' }}>
      {sorted.map((p) => (
        <PlaneRow
          key={p.hex}
          p={p}
          selected={selected}
          onSelect={onSelect}
          receiverLat={receiverLat}
          receiverLon={receiverLon}
          historical={false}
        />
      ))}

      {sortedHistorical.length > 0 && (
        <>
          {sorted.length > 0 && (
            <div style={{
              fontSize: 10, color: 'var(--text3)', letterSpacing: 0.8,
              padding: '8px 2px 2px', textTransform: 'uppercase', fontWeight: 600,
            }}>
              Storico recente
            </div>
          )}
          {sortedHistorical.map((p) => (
            <PlaneRow
              key={`h-${p.hex}`}
              p={p}
              selected={selected}
              onSelect={onSelect}
              receiverLat={receiverLat}
              receiverLon={receiverLon}
              historical={true}
            />
          ))}
        </>
      )}
    </div>
  )
}
