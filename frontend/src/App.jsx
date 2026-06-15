import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { usePlanes } from './usePlanes'
import PlaneMarker from './components/PlaneMarker'
import FlightList from './components/FlightList'
import { formatAlt, formatAltSub, formatSpeed, formatSpeedSub, haversineKm, formatDist } from './utils'
import Compass from './components/Compass'
import { squawkInfo } from './squawk'

const RECEIVER_LAT = import.meta.env.VITE_LAT ? parseFloat(import.meta.env.VITE_LAT) : 43.9
const RECEIVER_LON = import.meta.env.VITE_LON ? parseFloat(import.meta.env.VITE_LON) : 10.2

function FlyTo({ plane }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (plane && plane.hex !== prev.current) {
      map.flyTo([plane.lat, plane.lon], Math.max(map.getZoom(), 9), { duration: 0.6 })
      prev.current = plane.hex
    }
  }, [plane, map])
  return null
}

const card = {
  background: 'var(--card)',
  border: '1px solid var(--card-border)',
  borderRadius: 'var(--r-xl)',
}
const cardInner = {
  background: 'var(--card-inner)',
  borderRadius: 'var(--r-lg)',
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div style={{ ...cardInner, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent ?? 'var(--text)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function FullDetail({ plane, onClose }) {
  const sqInfo = squawkInfo(plane.squawk)
  const dist = haversineKm(RECEIVER_LAT, RECEIVER_LON, plane.lat, plane.lon)

  const baroRate = plane.baro_rate ?? plane.geom_rate
  const rateLabel = baroRate != null
    ? `${baroRate > 0 ? '↑' : baroRate < 0 ? '↓' : '→'} ${Math.abs(baroRate).toLocaleString()} ft/min`
    : null

  return (
    <div style={{ ...card, padding: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>
            {plane.flight?.trim() || plane.hex.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
            {plane.hex.toUpperCase()}
            {plane.squawk && (
              sqInfo
                ? <span style={{ color: sqInfo.color, fontFamily: 'var(--font)', fontWeight: 600, marginLeft: 6 }}>
                    {sqInfo.icon ? `${sqInfo.icon} ` : ''}{sqInfo.label}
                  </span>
                : <span style={{ marginLeft: 6 }}>SQK {plane.squawk}</span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'var(--card-inner)', border: 'none', borderRadius: 20,
          color: 'var(--text2)', width: 28, height: 28, cursor: 'pointer',
          fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {/* Compass + altitude + speed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'start', marginBottom: 8 }}>
        <StatTile label="Altitude" value={formatAlt(plane.alt_baro)} sub={formatAltSub(plane.alt_baro)} />
        <StatTile label="Speed GS" value={formatSpeed(plane.gs)} sub={formatSpeedSub(plane.gs)} />
        <Compass heading={plane.track} size={76} />
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <StatTile label="Alt. geometrica" value={formatAlt(plane.alt_geom)} sub={formatAltSub(plane.alt_geom)} />
        <StatTile label="Rateo vert." value={rateLabel} accent={baroRate > 0 ? 'var(--green)' : baroRate < 0 ? '#ff9f0a' : null} />
        <StatTile label="Distanza" value={formatDist(dist)} />
      </div>

      {/* Row 3: speeds */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <StatTile label="IAS" value={plane.ias != null ? `${plane.ias} kt` : null} sub={plane.ias != null ? `${Math.round(plane.ias * 1.852)} km/h` : null} />
        <StatTile label="TAS" value={plane.tas != null ? `${plane.tas} kt` : null} sub={plane.tas != null ? `${Math.round(plane.tas * 1.852)} km/h` : null} />
        <StatTile label="Mach" value={plane.mach != null ? plane.mach.toFixed(2) : null} />
      </div>

      {/* Row 4: heading variants */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <StatTile label="Heading vero" value={plane.true_heading != null ? `${Math.round(plane.true_heading)}°` : null} />
        <StatTile label="Heading mag." value={plane.mag_heading != null ? `${Math.round(plane.mag_heading)}°` : null} />
        <StatTile label="Roll" value={plane.roll != null ? `${plane.roll.toFixed(1)}°` : null} />
      </div>

      {/* Row 5: autopilot targets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <StatTile label="Nav. quota MCP" value={plane.nav_altitude_mcp != null ? formatAlt(plane.nav_altitude_mcp) : null} />
        <StatTile label="Nav. quota FMS" value={plane.nav_altitude_fms != null ? formatAlt(plane.nav_altitude_fms) : null} />
        <StatTile label="Nav. heading" value={plane.nav_heading != null ? `${Math.round(plane.nav_heading)}°` : null} />
      </div>

      {/* Row 6: meteo */}
      {(plane.wind_speed != null || plane.oat != null || plane.tat != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <StatTile label="Vento" value={plane.wind_speed != null ? `${plane.wind_speed} kt` : null} sub={plane.wind_dir != null ? `${plane.wind_dir}°` : null} />
          <StatTile label="OAT" value={plane.oat != null ? `${plane.oat} °C` : null} />
          <StatTile label="TAT" value={plane.tat != null ? `${plane.tat} °C` : null} />
        </div>
      )}

      {/* Row 7: segnale + categoria */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <StatTile label="Categoria" value={plane.category ?? null} />
        <StatTile label="RSSI" value={plane.rssi != null ? `${plane.rssi.toFixed(1)} dB` : null} />
        <StatTile label="Messaggi" value={plane.messages?.toLocaleString() ?? null} />
      </div>

      {/* Row 8: position source + timing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <StatTile label="Tipo" value={plane.type ?? null} />
        <StatTile label="Visto" value={plane.seen != null ? `${plane.seen.toFixed(0)}s fa` : null} />
        <StatTile label="Pos. vista" value={plane.seen_pos != null ? `${plane.seen_pos.toFixed(0)}s fa` : null} />
      </div>

      {/* Coords */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatTile label="Latitudine" value={plane.lat?.toFixed(5)} />
        <StatTile label="Longitudine" value={plane.lon?.toFixed(5)} />
      </div>

      {/* Emergency */}
      {plane.emergency && plane.emergency !== 'none' && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 'var(--r-md)',
          background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.4)',
          fontSize: 13, fontWeight: 700, color: 'var(--red)',
        }}>
          ⚠️ Emergenza: {plane.emergency}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const { planes, lastUpdate, error } = usePlanes()
  const [selectedHex, setSelectedHex] = useState(null)

  const selectedPlane = planes.find((p) => p.hex === selectedHex) ?? null

  function handleListSelect(hex) {
    setSelectedHex((prev) => (prev === hex ? null : hex))
  }

  const timeStr = lastUpdate?.toLocaleTimeString('it-IT', { hour12: false }) ?? '--:--:--'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={[RECEIVER_LAT, RECEIVER_LON]} zoom={8} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            maxZoom={19}
          />
          {planes.map((p) => (
            <PlaneMarker key={p.hex} plane={p} selected={p.hex === selectedHex} />
          ))}
          <FlyTo plane={selectedPlane} />
        </MapContainer>
      </div>

      {/* Sidebar */}
      <aside style={{
        width: 340, display: 'flex', flexDirection: 'column',
        gap: 12, padding: 16, overflowY: 'auto',
        flexShrink: 0, background: 'transparent',
      }}>

        {/* Header */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 6 }}>
            Radar ADS-B
          </div>
          <div style={{
            fontSize: 14, fontWeight: 600, marginBottom: 16,
            color: error ? 'var(--red)' : planes.length > 0 ? 'var(--green)' : 'var(--text2)',
          }}>
            {error ? 'Feed non raggiungibile' : planes.length > 0 ? 'Receiver online' : 'In attesa di dati…'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Aerei visibili', value: error ? '—' : String(planes.length) },
              { label: 'Aggiornamento', value: timeStr },
            ].map(({ label, value }) => (
              <div key={label} style={{ ...cardInner, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Full detail (only when selected from list) */}
        {selectedPlane && (
          <FullDetail plane={selectedPlane} onClose={() => setSelectedHex(null)} />
        )}

        {/* Flight list */}
        <div style={{ ...card, overflow: 'hidden', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Voli</span>
            {selectedHex && (
              <button onClick={() => setSelectedHex(null)} style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>Deseleziona</button>
            )}
          </div>
          <FlightList
            planes={planes}
            selected={selectedHex}
            onSelect={handleListSelect}
            receiverLat={RECEIVER_LAT}
            receiverLon={RECEIVER_LON}
          />
        </div>
      </aside>
    </div>
  )
}
