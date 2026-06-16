import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { formatAlt, formatAltSub, formatSpeed, formatSpeedSub } from '../utils'
import { squawkInfo } from '../squawk'

function isPegaso(flight) {
  if (!flight) return false
  const f = flight.trim().toUpperCase()
  return f.startsWith('PEGASO') || f.startsWith('PGSO')
}

function isHelicopter(plane) {
  return isPegaso(plane.flight) || plane.category === 'A7' || plane.category === 'B2'
}

function helicopterSvg(angle, color, size) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}">
      <g transform="rotate(${angle}, 20, 20)">
        <!-- Main rotor -->
        <ellipse cx="20" cy="20" rx="16" ry="2.5" fill="${color}" opacity="0.75"/>
        <ellipse cx="20" cy="20" rx="2.5" ry="16" fill="${color}" opacity="0.75"/>
        <!-- Hub -->
        <circle cx="20" cy="20" r="3" fill="${color}"/>
        <!-- Fuselage -->
        <ellipse cx="20" cy="26" rx="4" ry="7" fill="${color}" opacity="0.95"/>
        <!-- Tail boom -->
        <rect x="18.5" y="31" width="3" height="6" rx="1.5" fill="${color}" opacity="0.85"/>
        <!-- Tail rotor -->
        <ellipse cx="20" cy="37" rx="5" ry="1.2" fill="${color}" opacity="0.7"/>
        <!-- Skids -->
        <rect x="13" y="32" width="6" height="1.2" rx="0.6" fill="${color}" opacity="0.6"/>
        <rect x="21" y="32" width="6" height="1.2" rx="0.6" fill="${color}" opacity="0.6"/>
      </g>
    </svg>`
}

function planeSvg(angle, color, size) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}">
      <g transform="rotate(${angle}, 20, 20)">
        <ellipse cx="20" cy="20" rx="2.5" ry="13" fill="${color}" opacity="0.95"/>
        <ellipse cx="20" cy="10" rx="2" ry="3" fill="${color}"/>
        <path d="M20,17 C17,17 8,21 4,25 L6,26 C10,23 17,20 20,20 C23,20 30,23 34,26 L36,25 C32,21 23,17 20,17Z"
              fill="${color}" opacity="0.9"/>
        <path d="M20,30 C18.5,30 15,32 14,34 L15.5,34.5 C17,33 19,32 20,32 C21,32 23,33 24.5,34.5 L26,34 C25,32 21.5,30 20,30Z"
              fill="${color}" opacity="0.85"/>
      </g>
    </svg>`
}

function makeIcon(plane, selected, historical) {
  const angle   = plane.track ?? 0
  const heli    = isHelicopter(plane)
  const pegaso  = isPegaso(plane.flight)
  const color   = selected ? '#0a84ff' : historical ? '#888888' : pegaso ? '#ff453a' : '#fac123'
  const glow    = selected ? 'rgba(10,132,255,0.6)' : historical ? 'rgba(120,120,120,0.3)' : pegaso ? 'rgba(255,69,58,0.5)' : 'rgba(250,193,35,0.45)'
  const size    = selected ? 40 : 30

  const svg = heli ? helicopterSvg(angle, color, size) : planeSvg(angle, color, size)
  const half = size / 2

  return L.divIcon({
    html: `<div style="filter:drop-shadow(0 0 6px ${glow}) drop-shadow(0 1px 3px rgba(0,0,0,0.8))">${svg}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half - 4],
  })
}

export default function PlaneMarker({ plane, selected, onClick, historical }) {
  const callsign = plane.flight?.trim() || plane.hex.toUpperCase()
  const icon = makeIcon(plane, selected, historical)
  const pegaso = isPegaso(plane.flight)

  return (
    <Marker
      position={[plane.lat, plane.lon]}
      icon={icon}
      eventHandlers={{ click: () => onClick?.(plane.hex) }}
      zIndexOffset={selected ? 1000 : pegaso ? 500 : 0}
    >
      <Popup>
        <div style={{ padding: '4px 2px', minWidth: 170 }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
            {pegaso && <span style={{ marginRight: 6 }}>🚁</span>}
            {callsign}
          </div>
          {pegaso && (
            <div style={{ fontSize: 11, color: '#ff453a', fontWeight: 600, marginBottom: 8 }}>
              ELISOCCORSO · Storico 7 giorni
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 8, fontSize: 13 }}>
            {[
              ['Altitude',  formatAlt(plane.alt_baro), formatAltSub(plane.alt_baro)],
              ['Speed',     formatSpeed(plane.gs),     formatSpeedSub(plane.gs)],
              ['Heading',   plane.track != null ? `${Math.round(plane.track)}°` : '—', null],
              ['Squawk',    (() => {
                if (!plane.squawk) return '—'
                const info = squawkInfo(plane.squawk)
                return info ? <span style={{ color: info.color }}>{plane.squawk} — {info.label}</span> : plane.squawk
              })(), null],
            ].map(([k, v, sub]) => (
              <><span style={{ color: 'var(--text3)' }}>{k}</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>
                {v}
                {sub && <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>{sub}</span>}
              </span></>
            ))}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}
