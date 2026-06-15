import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { usePlanes } from './usePlanes'
import PlaneMarker from './components/PlaneMarker'
import FlightList from './components/FlightList'
import { formatAlt, formatSpeed, haversineKm, formatDist } from './utils'

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

const glass = {
  background: 'rgba(28,28,30,0.82)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.09)',
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>

      {/* Titlebar */}
      <header style={{
        ...glass,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52, flexShrink: 0,
        borderLeft: 'none', borderRight: 'none', borderTop: 'none',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>✈</span>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.3 }}>HydraPlanes</span>
          <span style={{
            fontSize: 11, color: 'var(--text2)', background: 'var(--bg3)',
            padding: '2px 8px', borderRadius: 20, marginLeft: 2,
          }}>ADS-B</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          <span style={{ color: 'var(--text2)' }}>
            <span style={{ color: error ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
              {error ? '!' : planes.length}
            </span>
            {' '}aircraft
          </span>
          <span style={{ color: 'var(--text3)', fontSize: 12 }}>{timeStr}</span>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: error ? 'var(--red)' : 'var(--green)',
            boxShadow: `0 0 8px ${error ? 'var(--red)' : 'var(--green)'}`,
            animation: error ? 'none' : 'pulse 2s infinite',
          }}/>
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={[RECEIVER_LAT, RECEIVER_LON]}
            zoom={8}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
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

        {/* Sidebar */}
        <aside style={{
          ...glass,
          width: 300,
          display: 'flex',
          flexDirection: 'column',
          borderTop: 'none',
          borderBottom: 'none',
          borderRight: 'none',
          overflow: 'hidden',
          flexShrink: 0,
          zIndex: 5,
        }}>

          {/* Selected aircraft detail */}
          {selectedPlane ? (
            <div style={{
              padding: 16,
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
                    {selectedPlane.flight?.trim() || selectedPlane.hex.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                    {selectedPlane.hex.toUpperCase()}
                    {selectedPlane.squawk ? ` · SQK ${selectedPlane.squawk}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedHex(null)}
                  style={{
                    background: 'var(--bg3)', border: 'none', borderRadius: 20,
                    color: 'var(--text2)', width: 26, height: 26, cursor: 'pointer',
                    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Altitude', value: formatAlt(selectedPlane.alt_baro) },
                  { label: 'Speed', value: formatSpeed(selectedPlane.gs) },
                  { label: 'Heading', value: selectedPlane.track != null ? `${Math.round(selectedPlane.track)}°` : '—' },
                  { label: 'Distance', value: formatDist(haversineKm(RECEIVER_LAT, RECEIVER_LON, selectedPlane.lat, selectedPlane.lon)) },
                  { label: 'Lat', value: selectedPlane.lat.toFixed(3) },
                  { label: 'Lon', value: selectedPlane.lon.toFixed(3) },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: 'var(--bg3)', borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Flights</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                {planes.length} aircraft in range
              </div>
            </div>
          )}

          <FlightList
            planes={planes}
            selected={selectedHex}
            onSelect={handleSelect}
            receiverLat={RECEIVER_LAT}
            receiverLon={RECEIVER_LON}
          />
        </aside>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
