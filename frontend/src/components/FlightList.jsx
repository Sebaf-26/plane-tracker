import { formatAlt, formatSpeed, formatDist, haversineKm } from '../utils'

// MDI paths
const MDI_AIRPLANE   = 'M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z'
const MDI_HELICOPTER = 'M22,10V9H17V4H16V9H13.74C13.37,8.39 12.74,8 12,8C11.26,8 10.63,8.39 10.26,9H8V4H7V9H2V10H7V11.26C7,11.26 7,11.26 7,11.27C5.21,11.81 4,13.26 4,15V18H20V15C20,13.26 18.79,11.81 17,11.27V10H22M12,10A1,1 0 0,1 13,11A1,1 0 0,1 12,12A1,1 0 0,1 11,11A1,1 0 0,1 12,10M6,16H4.5V15C4.5,14 5.12,13.17 6,12.76V16M12,16H7V12.34C7.31,12.12 7.64,12 8,12H16C16.36,12 16.69,12.12 17,12.34V16H12M19.5,16H18V12.76C18.88,13.17 19.5,14 19.5,15V16Z'
const MDI_FIRE       = 'M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z'

function isPegaso(flight) {
  if (!flight) return false
  const f = flight.trim().toUpperCase()
  return f.startsWith('PEGASO') || f.startsWith('PGSO')
}

function isGdF(flight) {
  if (!flight) return false
  return flight.trim().toUpperCase().startsWith('VOLP')
}

const HELI_CATEGORIES = new Set(['B1', 'B2', 'A7'])

function isHelicopter(p) {
  return isPegaso(p.flight) || HELI_CATEGORIES.has(p.category)
}

function PlaneRow({ p, selected, onSelect, receiverLat, receiverLon, historical }) {
  const callsign = p.flight?.trim() || p.hex.toUpperCase()
  const dist = haversineKm(receiverLat, receiverLon, p.lat, p.lon)
  const isSelected = p.hex === selected
  const pegaso = isPegaso(p.flight)
  const gdf = isGdF(p.flight)
  const heli = isHelicopter(p)

  const gdf = isGdF(p.flight)
  const iconColor = historical ? '#666' : isSelected ? '#000' : pegaso ? '#ff453a' : gdf ? '#ff9f0a' : '#fac123'
  const bgColor = isSelected ? 'var(--accent)'
    : historical ? 'rgba(120,120,120,0.25)'
    : pegaso ? 'rgba(255,69,58,0.2)'
    : gdf ? 'rgba(255,159,10,0.15)'
    : 'rgba(250,193,35,0.15)'
  const borderColor = isSelected ? 'rgba(250,193,35,0.35)'
    : pegaso && !historical ? 'rgba(255,69,58,0.25)'
    : gdf && !historical ? 'rgba(255,159,10,0.3)'
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
          <path d={gdf ? MDI_FIRE : heli ? MDI_HELICOPTER : MDI_AIRPLANE} fill={isSelected ? 'var(--accent)' : iconColor} />
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
