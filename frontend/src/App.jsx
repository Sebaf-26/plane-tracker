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

export default function App() {
  const { planes, lastUpdate, error } = usePlanes()
  const [selectedHex, setSelectedHex] = useState(null)

  const selectedPlane = planes.find((p) => p.hex === selectedHex) ?? null

  function handleSelect(hex) {
    setSelectedHex((prev) => (prev === hex ? null : hex))
  }

  const timeStr = lastUpdate?.toLocaleTimeString('it-IT', { hour12: false }) ?? '--:--:--'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Left: map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[RECEIVER_LAT, RECEIVER_LON]}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            maxZoom={19}
          />
          {planes.map((p) => (
            <PlaneMarker
              key={p.hex}
              plane={p}
              selected={p.hex === selectedHex}
              onClick={handleSelect}
            />
          ))}
          <FlyTo plane={selectedPlane} />
        </MapContainer>
      </div>

      {/* Right: sidebar */}
      <aside style={{
        width: 340,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        overflowY: 'auto',
        flexShrink: 0,
        background: 'transparent',
      }}>

        {/* Header card */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 6 }}>
            Radar ADS-B
          </div>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: error ? 'var(--red)' : planes.length > 0 ? 'var(--green)' : 'var(--text2)',
            marginBottom: 16,
          }}>
            {error ? 'Feed non raggiungibile' : planes.length > 0 ? 'Receiver online' : 'In attesa di dati…'}
          </div>

          {/* Stat cards */}
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

        {/* Selected aircraft detail */}
        {selectedPlane && (
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>
                  {selectedPlane.flight?.trim() || selectedPlane.hex.toUpperCase()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
                  {selectedPlane.hex.toUpperCase()}
                  {selectedPlane.squawk && (() => {
                    const info = squawkInfo(selectedPlane.squawk)
                    return info
                      ? <span style={{ color: info.color, fontFamily: 'var(--font)', fontWeight: 600, marginLeft: 6 }}>
                          {info.icon ? `${info.icon} ` : ''}{info.label}
                        </span>
                      : <span style={{ marginLeft: 6 }}>SQK {selectedPlane.squawk}</span>
                  })()}
                </div>
              </div>
              <button onClick={() => setSelectedHex(null)} style={{
                background: 'var(--card-inner)', border: 'none', borderRadius: 20,
                color: 'var(--text2)', width: 28, height: 28, cursor: 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            {/* Top row: altitude + speed + compass */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'start' }}>
              {/* Altitude */}
              <div style={{ ...cardInner, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Altitude</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{formatAlt(selectedPlane.alt_baro)}</div>
                {formatAltSub(selectedPlane.alt_baro) && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{formatAltSub(selectedPlane.alt_baro)}</div>
                )}
              </div>
              {/* Speed */}
              <div style={{ ...cardInner, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Speed</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{formatSpeed(selectedPlane.gs)}</div>
                {formatSpeedSub(selectedPlane.gs) && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{formatSpeedSub(selectedPlane.gs)}</div>
                )}
              </div>
              {/* Compass */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Compass heading={selectedPlane.track} size={76} />
              </div>
            </div>

            {/* Bottom row: distance + coords */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
              {[
                ['Distance', formatDist(haversineKm(RECEIVER_LAT, RECEIVER_LON, selectedPlane.lat, selectedPlane.lon))],
                ['Lat',      selectedPlane.lat.toFixed(4)],
                ['Lon',      selectedPlane.lon.toFixed(4)],
              ].map(([label, value]) => (
                <div key={label} style={{ ...cardInner, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flights card */}
        <div style={{ ...card, overflow: 'hidden', flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 16px 12px',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Voli</span>
            {selectedHex && (
              <button onClick={() => setSelectedHex(null)} style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>
                Deseleziona
              </button>
            )}
          </div>
          <FlightList
            planes={planes}
            selected={selectedHex}
            onSelect={handleSelect}
            receiverLat={RECEIVER_LAT}
            receiverLon={RECEIVER_LON}
          />
        </div>
      </aside>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
