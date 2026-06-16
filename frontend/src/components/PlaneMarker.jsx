import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { formatAlt, formatAltSub, formatSpeed, formatSpeedSub } from '../utils'
import { squawkInfo } from '../squawk'

// MDI paths (viewBox 0 0 24 24)
const MDI_AIRPLANE    = 'M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z'
const MDI_HELICOPTER  = 'M22,10V9H17V4H16V9H13.74C13.37,8.39 12.74,8 12,8C11.26,8 10.63,8.39 10.26,9H8V4H7V9H2V10H7V11.26C7,11.26 7,11.26 7,11.27C5.21,11.81 4,13.26 4,15V18H20V15C20,13.26 18.79,11.81 17,11.27V10H22M12,10A1,1 0 0,1 13,11A1,1 0 0,1 12,12A1,1 0 0,1 11,11A1,1 0 0,1 12,10M6,16H4.5V15C4.5,14 5.12,13.17 6,12.76V16M12,16H7V12.34C7.31,12.12 7.64,12 8,12H16C16.36,12 16.69,12.12 17,12.34V16H12M19.5,16H18V12.76C18.88,13.17 19.5,14 19.5,15V16Z'
const MDI_FIRE        = 'M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z'

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

function isHelicopter(plane) {
  return isPegaso(plane.flight) || HELI_CATEGORIES.has(plane.category)
}

function makeIcon(plane, selected, historical) {
  const angle  = plane.track ?? 0
  const heli   = isHelicopter(plane)
  const pegaso = isPegaso(plane.flight)
  const gdf    = isGdF(plane.flight)
  const color  = selected ? '#0a84ff' : historical ? '#777777' : pegaso ? '#ff453a' : gdf ? '#ff9f0a' : '#fac123'
  const glow   = selected ? 'rgba(10,132,255,0.7)' : historical ? 'rgba(100,100,100,0.3)' : pegaso ? 'rgba(255,69,58,0.55)' : gdf ? 'rgba(255,159,10,0.6)' : 'rgba(250,193,35,0.5)'
  const size   = selected ? 36 : 28

  const path   = gdf ? MDI_FIRE : heli ? MDI_HELICOPTER : MDI_AIRPLANE
  const rotate = (heli || gdf) ? 0 : angle

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
