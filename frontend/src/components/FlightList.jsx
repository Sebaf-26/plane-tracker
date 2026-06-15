import { formatAlt, formatSpeed, formatDist, haversineKm } from '../utils'

export default function FlightList({ planes, selected, onSelect, receiverLat, receiverLon }) {
  const sorted = [...planes].sort((a, b) => {
    const da = haversineKm(receiverLat, receiverLon, a.lat, a.lon)
    const db = haversineKm(receiverLat, receiverLon, b.lat, b.lon)
    return da - db
  })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
      {sorted.length === 0 && (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 32, fontSize: 14 }}>
          No aircraft detected
        </div>
      )}
      {sorted.map((p) => {
        const callsign = p.flight?.trim() || p.hex.toUpperCase()
        const dist = haversineKm(receiverLat, receiverLon, p.lat, p.lon)
        const isSelected = p.hex === selected
        const onGround = p.alt_baro === 'ground' || p.alt_baro === 0

        return (
          <div
            key={p.hex}
            onClick={() => onSelect(p.hex)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              cursor: 'pointer',
              background: isSelected ? 'var(--blue-dim)' : 'transparent',
              borderLeft: isSelected ? '2px solid var(--blue)' : '2px solid transparent',
              transition: 'background 0.15s',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: isSelected ? 'rgba(10,132,255,0.15)' : 'var(--bg3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
              transform: `rotate(${p.track ?? 0}deg)`,
              color: onGround ? 'var(--text3)' : isSelected ? 'var(--blue)' : 'var(--green)',
            }}>
              ✈
            </div>

            {/* Main info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: isSelected ? 'var(--blue)' : 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {callsign}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>
                {formatAlt(p.alt_baro)} · {formatSpeed(p.gs)}
              </div>
            </div>

            {/* Distance */}
            <div style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>
              {formatDist(dist)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
