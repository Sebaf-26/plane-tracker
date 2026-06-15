import { formatAlt, formatSpeed, formatDist, haversineKm } from '../utils'

const COL = { color: 'var(--green-dim)', fontSize: 10, marginBottom: 4 }

export default function FlightList({ planes, selected, onSelect, receiverLat, receiverLon }) {
  const sorted = [...planes].sort((a, b) => {
    const da = haversineKm(receiverLat, receiverLon, a.lat, a.lon)
    const db = haversineKm(receiverLat, receiverLon, b.lat, b.lon)
    return da - db
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ ...COL, display: 'grid', gridTemplateColumns: '5fr 3fr 3fr 3fr', padding: '0 8px 4px', borderBottom: '1px solid var(--green-border)', marginBottom: 0 }}>
        <span>CALLSIGN</span>
        <span>ALT</span>
        <span>SPD</span>
        <span>DIST</span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {sorted.length === 0 && (
          <div style={{ color: 'var(--green-dim)', padding: 16, textAlign: 'center', fontSize: 12 }}>
            NO AIRCRAFT DETECTED
          </div>
        )}
        {sorted.map((p) => {
          const callsign = p.flight?.trim() || p.hex.toUpperCase()
          const dist = haversineKm(receiverLat, receiverLon, p.lat, p.lon)
          const isSelected = p.hex === selected
          return (
            <div
              key={p.hex}
              onClick={() => onSelect(p.hex)}
              style={{
                display: 'grid',
                gridTemplateColumns: '5fr 3fr 3fr 3fr',
                padding: '5px 8px',
                cursor: 'pointer',
                fontSize: 12,
                borderBottom: '1px solid #0a1a0a',
                background: isSelected ? '#0a2a0a' : 'transparent',
                color: isSelected ? 'var(--yellow)' : 'var(--green)',
                borderLeft: isSelected ? '2px solid var(--yellow)' : '2px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {callsign}
              </span>
              <span>{formatAlt(p.alt_baro)}</span>
              <span>{formatSpeed(p.gs)}</span>
              <span>{formatDist(dist)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
