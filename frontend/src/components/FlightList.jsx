import { formatAlt, formatSpeed, formatDist, haversineKm } from '../utils'

function PlaneRow({ p, selected, onSelect, receiverLat, receiverLon, historical }) {
  const callsign = p.flight?.trim() || p.hex.toUpperCase()
  const dist = haversineKm(receiverLat, receiverLon, p.lat, p.lon)
  const isSelected = p.hex === selected

  return (
    <div
      onClick={() => onSelect(p.hex)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--r-lg)',
        background: isSelected ? 'var(--accent-dim)' : 'var(--card-inner)',
        border: `1px solid ${isSelected ? 'rgba(250,193,35,0.35)' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        opacity: historical ? 0.6 : 1,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: isSelected ? 'var(--accent)' : historical ? 'rgba(160,160,160,0.4)' : 'rgba(250,193,35,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
            fill={historical ? '#888' : '#000'}/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: isSelected ? 'var(--accent)' : historical ? 'var(--text3)' : 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
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
              padding: '6px 2px 2px', textTransform: 'uppercase', fontWeight: 600,
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
