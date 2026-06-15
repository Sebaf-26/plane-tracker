import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { formatAlt, formatSpeed } from '../utils'

function makeIcon(track, selected, onGround) {
  const color = selected ? '#ffd700' : onGround ? '#888' : '#00ff41'
  const angle = track ?? 0
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28">
      <g transform="rotate(${angle}, 16, 16)">
        <polygon points="16,3 19,13 28,13 28,15 19,15 21,26 24,26 24,28 16,25 8,28 8,26 11,26 13,15 4,15 4,13 13,13"
          fill="${color}" opacity="0.92"/>
      </g>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
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
        <div style={{ lineHeight: '1.7', minWidth: 140 }}>
          <div style={{ color: '#ffd700', fontSize: 14, marginBottom: 4 }}>
            ✈ {callsign}
          </div>
          <div>HEX: {plane.hex.toUpperCase()}</div>
          {plane.squawk && <div>SQK: {plane.squawk}</div>}
          <div>ALT: {formatAlt(plane.alt_baro)}</div>
          <div>SPD: {formatSpeed(plane.gs)}</div>
          {plane.track != null && <div>HDG: {Math.round(plane.track)}°</div>}
        </div>
      </Popup>
    </Marker>
  )
}
