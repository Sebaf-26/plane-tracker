import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { formatAlt, formatAltSub, formatSpeed, formatSpeedSub } from '../utils'
import { squawkInfo } from '../squawk'

// MDI paths (viewBox 0 0 24 24)
const MDI_AIRPLANE    = 'M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z'
const MDI_HELICOPTER  = 'M6,1H7V6H17V1H18V6H21V8H3V6H6V1M21,18.56C21,19.36 20.55,20.06 19.88,20.41L13,24V22H3A1,1 0 0,1 2,21V11H22V18.56M7,13V15H17V13H7Z'

function isPegaso(flight) {
  if (!flight) return false
  const f = flight.trim().toUpperCase()
  return f.startsWith('PEGASO') || f.startsWith('PGSO')
}

function isHelicopter(plane) {
  return isPegaso(plane.flight) || plane.category === 'B1' || plane.category === 'B2'
}

function makeIcon(plane, selected, historical) {
  const angle  = plane.track ?? 0
  const heli   = isHelicopter(plane)
  const pegaso = isPegaso(plane.flight)
  const color  = selected ? '#0a84ff' : historical ? '#777777' : pegaso ? '#ff453a' : '#fac123'
  const glow   = selected ? 'rgba(10,132,255,0.7)' : historical ? 'rgba(100,100,100,0.3)' : pegaso ? 'rgba(255,69,58,0.55)' : 'rgba(250,193,35,0.5)'
  const size   = selected ? 36 : 28

  const path = heli ? MDI_HELICOPTER : MDI_AIRPLANE
  // helicopters don't have a meaningful heading rotation from MDI icon shape, keep 0
  const rotate = heli ? 0 : angle

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
      <g transform="rotate(${rotate}, 12, 12)">
        <path d="${path}" fill="${color}"/>
      </g>
    </svg>`

  const half = size / 2
  return L.divIcon({
    html: `<div style="filter:drop-shadow(0 0 5px ${glow}) drop-shadow(0 1px 3px rgba(0,0,0,0.9))">${svg}</div>`,
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
      zIndexOffset={selected ? 1000 : pegaso ? 500 : historical ? -100 : 0}
    >
      <Popup>
        <div style={{ padding: '4px 2px', minWidth: 170 }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
            {pegaso && <span style={{ marginRight: 6 }}>🚁</span>}
            {callsign}
            {historical && <span style={{ fontSize: 12, color: '#888', marginLeft: 6, fontWeight: 400 }}>(storico)</span>}
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
