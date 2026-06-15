import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { formatAlt, formatSpeed } from '../utils'

function makeIcon(track, selected, onGround) {
  const angle = track ?? 0
  const color = selected ? '#0a84ff' : onGround ? '#636366' : '#30d158'
  const glow = selected ? 'rgba(10,132,255,0.6)' : onGround ? 'transparent' : 'rgba(48,209,88,0.5)'
  const size = selected ? 36 : 28

  // Top-down aircraft silhouette: fuselage + swept wings + tail
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}">
      <g transform="rotate(${angle}, 20, 20)">
        <!-- fuselage -->
        <ellipse cx="20" cy="20" rx="2.5" ry="13" fill="${color}" opacity="0.95"/>
        <!-- nose -->
        <ellipse cx="20" cy="8" rx="2" ry="3" fill="${color}"/>
        <!-- main wings -->
        <path d="M20,16 C17,16 8,20 4,24 L6,25 C10,22 17,19 20,19 C23,19 30,22 34,25 L36,24 C32,20 23,16 20,16Z"
              fill="${color}" opacity="0.9"/>
        <!-- tail fins -->
        <path d="M20,29 C18.5,29 15,31 14,33 L15.5,33.5 C17,32 19,31 20,31 C21,31 23,32 24.5,33.5 L26,33 C25,31 21.5,29 20,29Z"
              fill="${color}" opacity="0.85"/>
      </g>
    </svg>`

  const half = size / 2
  return L.divIcon({
    html: `<div style="filter:drop-shadow(0 0 5px ${glow}) drop-shadow(0 1px 3px rgba(0,0,0,0.8))">${svg}</div>`,
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
