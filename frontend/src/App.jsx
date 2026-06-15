import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { usePlanes } from './usePlanes'
import PlaneMarker from './components/PlaneMarker'
import FlightList from './components/FlightList'

const RECEIVER_LAT = import.meta.env.VITE_LAT ? parseFloat(import.meta.env.VITE_LAT) : 43.9
const RECEIVER_LON = import.meta.env.VITE_LON ? parseFloat(import.meta.env.VITE_LON) : 10.2

function FlyTo({ plane }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (plane && plane.hex !== prev.current) {
      map.flyTo([plane.lat, plane.lon], Math.max(map.getZoom(), 9), { duration: 0.8 })
      prev.current = plane.hex
    }
  }, [plane, map])
  return null
}

function ScanLine() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1000,
      background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,255,65,0.012) 3px, rgba(0,255,65,0.012) 4px)',
    }} />
  )
}

export default function App() {
  const { planes, lastUpdate, error } = usePlanes()
  const [selectedHex, setSelectedHex] = useState(null)

  const selectedPlane = planes.find((p) => p.hex === selectedHex) ?? null

  function handleSelect(hex) {
    setSelectedHex((prev) => (prev === hex ? null : hex))
  }

  const timeStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('it-IT', { hour12: false })
    : '--:--:--'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', borderBottom: '1px solid var(--green-border)',
        background: 'var(--bg-panel)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, letterSpacing: 3, color: 'var(--green)' }}>✈ HYDRAPLANES</span>
          <span style={{ fontSize: 11, color: 'var(--green-dim)', letterSpacing: 1 }}>ADS-B RADAR</span>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 12, alignItems: 'center' }}>
          <span>
            <span style={{ color: 'var(--green-dim)' }}>CONTACTS </span>
            <span style={{ color: error ? 'var(--red)' : 'var(--green)' }}>
              {error ? 'ERR' : planes.length}
            </span>
          </span>
          <span>
            <span style={{ color: 'var(--green-dim)' }}>UPD </span>
            <span>{timeStr}</span>
          </span>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: error ? 'var(--red)' : 'var(--green)',
            boxShadow: error ? '0 0 6px var(--red)' : '0 0 6px var(--green)',
            animation: error ? 'none' : 'blink 2s infinite',
          }} />
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Map */}
        <div style={{ position: 'relative', flex: 1 }}>
          <ScanLine />
          <MapContainer
            center={[RECEIVER_LAT, RECEIVER_LON]}
            zoom={8}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
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
          width: 320, display: 'flex', flexDirection: 'column',
          background: 'var(--bg-panel)', borderLeft: '1px solid var(--green-border)',
          overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{
            padding: '8px 10px', fontSize: 11, letterSpacing: 2,
            color: 'var(--green-dim)', borderBottom: '1px solid var(--green-border)',
            flexShrink: 0,
          }}>
            FLIGHT LIST
          </div>

          {/* Selected detail */}
          {selectedPlane && (
            <div style={{
              padding: '10px 12px', borderBottom: '1px solid var(--green-border)',
              background: '#0a1f0a', fontSize: 12, flexShrink: 0,
            }}>
              <div style={{ color: 'var(--yellow)', fontSize: 14, marginBottom: 6 }}>
                ✈ {selectedPlane.flight?.trim() || selectedPlane.hex.toUpperCase()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 0', color: 'var(--green)' }}>
                <span style={{ color: 'var(--green-dim)' }}>HEX</span>
                <span>{selectedPlane.hex.toUpperCase()}</span>
                {selectedPlane.squawk && <><span style={{ color: 'var(--green-dim)' }}>SQK</span><span>{selectedPlane.squawk}</span></>}
                <span style={{ color: 'var(--green-dim)' }}>ALT</span>
                <span>{selectedPlane.alt_baro === 'ground' ? 'GROUND' : selectedPlane.alt_baro != null ? `${Math.round(selectedPlane.alt_baro).toLocaleString()} ft` : '---'}</span>
                <span style={{ color: 'var(--green-dim)' }}>SPD</span>
                <span>{selectedPlane.gs != null ? `${Math.round(selectedPlane.gs)} kt` : '---'}</span>
                <span style={{ color: 'var(--green-dim)' }}>HDG</span>
                <span>{selectedPlane.track != null ? `${Math.round(selectedPlane.track)}°` : '---'}</span>
                {selectedPlane.category && <><span style={{ color: 'var(--green-dim)' }}>CAT</span><span>{selectedPlane.category}</span></>}
              </div>
              <button
                onClick={() => setSelectedHex(null)}
                style={{
                  marginTop: 8, background: 'transparent', border: '1px solid var(--green-border)',
                  color: 'var(--green-dim)', fontFamily: 'var(--font)', fontSize: 11,
                  padding: '2px 8px', cursor: 'pointer', letterSpacing: 1,
                }}
              >
                CLEAR
              </button>
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
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
