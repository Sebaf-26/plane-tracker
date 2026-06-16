import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { formatAlt, formatAltSub, formatSpeed, formatSpeedSub } from '../utils'
import { squawkInfo } from '../squawk'
import { getSpecial, iconPath } from '../specialCallsigns'

const HELI_CAT = new Set(['B1', 'B2', 'A7'])

function isHelicopter(plane) {
  const sp = getSpecial(plane.flight)
  if (sp && sp.icon === 'helicopter') return true
  return HELI_CAT.has(plane.category)
}

function makeIcon(plane, selected, historical) {
  const angle   = plane.track ?? 0
  const special = getSpecial(plane.flight)
  const heli    = isHelicopter(plane)

  const color = selected ? '#0a84ff'
    : historical ? '#777777'
    : special ? special.color
    : '#fac123'

  const glow = selected ? 'rgba(10,132,255,0.7)'
    : historical ? 'rgba(100,100,100,0.3)'
    : special ? `${special.color}88`
    : 'rgba(250,193,35,0.5)'

  const size = selected ? 36 : 28
  const path = iconPath(special, heli)
  const rotate = (special || heli) ? 0 : angle

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
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
  const special = getSpecial(plane.flight)

  return (
    <Marker
      position={[plane.lat, plane.lon]}
      icon={icon}
      eventHandlers={{ click: () => onClick?.(plane.hex) }}
      zIndexOffset={selected ? 1000 : special ? 500 : historical ? -100 : 0}
    >
      <Popup>
        <div style={{ padding: '4px 2px', minWidth: 170 }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
            {callsign}
            {historical && <span style={{ fontSize: 12, color: '#888', marginLeft: 6, fontWeight: 400 }}>(storico)</span>}
          </div>
          {special && (
            <div style={{ fontSize: 11, color: special.color, fontWeight: 600, marginBottom: 8 }}>
              {special.label}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 8, fontSize: 13 }}>
            {[
              ['Altitude', formatAlt(plane.alt_baro), formatAltSub(plane.alt_baro)],
              ['Speed',    formatSpeed(plane.gs),     formatSpeedSub(plane.gs)],
              ['Heading',  plane.track != null ? `${Math.round(plane.track)}°` : '—', null],
              ['Squawk',   (() => {
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
