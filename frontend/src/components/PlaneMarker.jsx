import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { formatAlt, formatAltSub, formatSpeed, formatSpeedSub } from '../utils'
import { squawkInfo } from '../squawk'

function makeIcon(track, selected) {
  const angle = track ?? 0
  const bg = selected ? '#fac123' : 'rgba(250,193,35,0.85)'
  const size = selected ? 38 : 30
  const fontSize = selected ? 14 : 11

  const svg = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${bg};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 12px rgba(250,193,35,${selected ? 0.6 : 0.35}),0 1px 4px rgba(0,0,0,0.5);
        transform:scale(1);
        transition:all 0.2s;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${fontSize + 2}" height="${fontSize + 2}">
          <g transform="rotate(${angle - 45}, 12, 12)">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
              fill="#000" opacity="0.85"/>
          </g>
        </svg>
      </div>
    </div>`

  const w = Math.max(size, 60)
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [w, size + 6],
    iconAnchor: [w / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  })
}

export default function PlaneMarker({ plane, selected, onClick }) {
  const callsign = plane.flight?.trim() || plane.hex.toUpperCase()
  const icon = makeIcon(plane.track, selected)

  return (
    <Marker
      position={[plane.lat, plane.lon]}
      icon={icon}
      eventHandlers={{ click: () => onClick(plane.hex) }}
      zIndexOffset={selected ? 1000 : 0}
    >
      <Popup>
        <div style={{ padding: '4px 2px', minWidth: 170 }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{callsign}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 8, fontSize: 13 }}>
            {[
              ['Altitude', formatAlt(plane.alt_baro), formatAltSub(plane.alt_baro)],
              ['Speed',    formatSpeed(plane.gs),     formatSpeedSub(plane.gs)],
              ['Heading',  plane.track != null ? `${Math.round(plane.track)}°` : '—', null],
              ['Squawk', (() => {
                if (!plane.squawk) return '—'
                const info = squawkInfo(plane.squawk)
                return info
                  ? <span style={{ color: info.color }}>{plane.squawk} — {info.label}</span>
                  : plane.squawk
              })(), null],
            ].map(([k, v, sub]) => (
              <><span style={{ color: 'var(--text3)' }}>{k}</span>
              <span style={{ textAlign: 'right', fontWeight: 600 }}>
                {v}
                {sub && <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>{sub}</span>}
              </span></>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            {plane.hex.toUpperCase()}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}
