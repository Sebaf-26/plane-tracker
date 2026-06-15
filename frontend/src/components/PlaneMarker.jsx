import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { formatAlt, formatSpeed } from '../utils'

function makeIcon(track, selected, onGround) {
  const angle = track ?? 0
  const color = selected ? '#0a84ff' : onGround ? '#636366' : '#30d158'
  const shadow = selected ? 'rgba(10,132,255,0.5)' : onGround ? 'transparent' : 'rgba(48,209,88,0.4)'
  const size = selected ? 32 : 26

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g transform="rotate(${angle}, 16, 16)" filter="url(#glow)">
        <polygon points="16,3 19,13 28,13 28,15 19,15 21,26 24,26 24,28 16,25 8,28 8,26 11,26 13,15 4,15 4,13 13,13"
          fill="${color}"/>
      </g>
    </svg>`

  const half = size / 2
  return L.divIcon({
    html: `<div style="filter:drop-shadow(0 0 6px ${shadow})">${svg}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half - 4],
  })
}

export default function PlaneMarker({ plane, selected, onClick }) {
  const onGround = plane.alt_baro === 'ground' || plane.alt_baro === 0
  const icon = makeIcon(plane.track, selected, onGround)
  const callsign = plane.flight?.trim() || plane.hex.toUpperCase()

  return (
    <Marker
      position={[plane.lat, plane.lon]}
      icon={icon}
      eventHandlers={{ click: () => onClick(plane.hex) }}
      zIndexOffset={selected ? 1000 : 0}
    >
      <Popup>
        <div style={{ padding: '4px 2px', minWidth: 160 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: '#f5f5f7' }}>
            {callsign}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 0', fontSize: 13 }}>
            <span style={{ color: 'rgba(245,245,247,0.5)' }}>Altitude</span>
            <span style={{ color: '#f5f5f7', textAlign: 'right' }}>{formatAlt(plane.alt_baro)}</span>
            <span style={{ color: 'rgba(245,245,247,0.5)' }}>Speed</span>
            <span style={{ color: '#f5f5f7', textAlign: 'right' }}>{formatSpeed(plane.gs)}</span>
            {plane.track != null && <>
              <span style={{ color: 'rgba(245,245,247,0.5)' }}>Heading</span>
              <span style={{ color: '#f5f5f7', textAlign: 'right' }}>{Math.round(plane.track)}°</span>
            </>}
            {plane.squawk && <>
              <span style={{ color: 'rgba(245,245,247,0.5)' }}>Squawk</span>
              <span style={{ color: '#f5f5f7', textAlign: 'right' }}>{plane.squawk}</span>
            </>}
            <span style={{ color: 'rgba(245,245,247,0.5)' }}>Hex</span>
            <span style={{ color: '#f5f5f7', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{plane.hex.toUpperCase()}</span>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}
