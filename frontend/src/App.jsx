import { useState, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, useMap, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { usePlanes } from './usePlanes'
import { useTrails } from './useTrails'
import { useKnown } from './useKnown'
import PlaneMarker from './components/PlaneMarker'
import TrailLine from './components/TrailLine'
import RangeCircles from './components/RangeCircles'
import FlightList from './components/FlightList'
import BottomPanel from './components/BottomPanel'
import { formatAlt, formatAltSub, formatSpeed, formatSpeedSub, haversineKm, formatDist, slantRangeKm } from './utils'
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

const card    = { background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 'var(--r-xl)' }
const cardInner = { background: 'var(--card-inner)', borderRadius: 'var(--r-lg)' }

function StatTile({ label, value, sub, accent, tooltip }) {
  const empty = value == null
  const [popupPos, setPopupPos] = useState(null)

  function handleInfo(e) {
    e.stopPropagation()
    if (popupPos) { setPopupPos(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    setPopupPos({ x: r.left, y: r.top })
  }

  return (
    <div style={{ ...cardInner, padding: '13px 14px' }}>
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 0.3 }}>{label}</span>
        {tooltip && (
          <button
            onClick={handleInfo}
            style={{
              width: 15, height: 15, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)',
              background: popupPos ? 'rgba(250,193,35,0.3)' : 'rgba(255,255,255,0.08)',
              color: popupPos ? 'var(--accent)' : 'var(--text3)',
              fontSize: 9, fontWeight: 800, lineHeight: 1,
              cursor: 'pointer', flexShrink: 0, padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >i</button>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: empty ? 'var(--text3)' : (accent ?? 'var(--text)'), lineHeight: 1.2 }}>
        {empty ? '—' : value}
      </div>
      {!empty && sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>}

      {/* Info popup — fixed position, never clipped */}
      {popupPos && tooltip && typeof document !== 'undefined' && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9500 }} onClick={() => setPopupPos(null)} />
          <div style={{
            position: 'fixed',
            top: Math.min(popupPos.y + 20, window.innerHeight - 140),
            left: Math.max(8, Math.min(popupPos.x - 120, window.innerWidth - 260)),
            width: 240,
            zIndex: 9501,
            background: '#1c2333',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 12, padding: '12px 14px',
            fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.55,
            boxShadow: '0 12px 40px rgba(0,0,0,0.75)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginBottom: 5, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
            {tooltip}
          </div>
        </>
      )}
    </div>
  )
}

function DetailSections({ sections }) {
  const [open, setOpen] = useState(() => Object.fromEntries(sections.map(s => [s.title, true])))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sections.map(({ title, icon, tiles }) => {
        const isOpen = open[title]
        return (
          <div key={title} style={{ ...cardInner, overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(p => ({ ...p, [title]: !isOpen }))}
              style={{
                width: '100%', background: 'none', border: 'none', padding: '9px 12px',
                display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                color: 'var(--text)', fontFamily: 'var(--font)',
              }}
            >
              <span style={{ fontSize: 13 }}>{icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, flex: 1, textAlign: 'left', letterSpacing: 0.3 }}>{title}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
            </button>
            {isOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '0 8px 8px' }}>
                {tiles.map(t => <StatTile key={t.label} {...t} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function useAircraftInfo(hex) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    if (!hex) return
    setInfo(null)
    fetch(`/api/aircraft/${hex}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setInfo(d) })
      .catch(() => {})
  }, [hex])
  return info
}

function FullDetail({ plane, onClose }) {
  const sqInfo = squawkInfo(plane.squawk)
  const acInfo = useAircraftInfo(plane.hex)
  const dist = haversineKm(RECEIVER_LAT, RECEIVER_LON, plane.lat, plane.lon)
  const baroRate = plane.baro_rate ?? plane.geom_rate
  const rateLabel = baroRate != null
    ? `${baroRate > 0 ? '↑' : baroRate < 0 ? '↓' : '→'} ${Math.abs(baroRate).toLocaleString()} ft/min`
    : null

  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>
            {plane.flight?.trim() || plane.hex.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
            {plane.hex.toUpperCase()}
            {plane.squawk && (sqInfo
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

      {/* Aircraft info from adsbdb */}
      {acInfo && (acInfo.registration || acInfo.type || acInfo.owner) && (
        <div style={{
          ...cardInner, padding: '10px 12px', marginBottom: 10,
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          {acInfo.url_photo_thumb && (
            <img src={acInfo.url_photo_thumb} alt=""
              style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            {acInfo.registration && (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{acInfo.registration}</div>
            )}
            {(acInfo.manufacturer || acInfo.type) && (
              <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 1 }}>
                {[acInfo.manufacturer, acInfo.type].filter(Boolean).join(' ')}
              </div>
            )}
            {acInfo.owner && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{acInfo.owner}</div>
            )}
            {acInfo.country && (
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{acInfo.country}</div>
            )}
          </div>
        </div>
      )}

      {/* Compass + quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start', marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatTile label="Altitude" value={formatAlt(plane.alt_baro)} sub={formatAltSub(plane.alt_baro)} tooltip="Quota barometrica: misurata dalla pressione atmosferica, usata per la separazione del traffico aereo." />
          <StatTile label="Speed GS" value={formatSpeed(plane.gs)} sub={formatSpeedSub(plane.gs)} tooltip="Ground Speed: velocità dell'aereo rispetto al suolo (include l'effetto del vento)." />
          <StatTile label="Rateo vert." value={rateLabel} accent={baroRate > 0 ? 'var(--green)' : baroRate < 0 ? '#ff9f0a' : null} tooltip="Velocità di salita o discesa in piedi al minuto. Verde = salita, arancione = discesa." />
          <StatTile label="Track" value={plane.track != null ? `${Math.round(plane.track)}°` : null} tooltip="Direzione di movimento effettiva dell'aereo rispetto al Nord." />
        </div>
        <Compass heading={plane.track} size={88} />
      </div>

      {(() => {
        const groundKm = haversineKm(RECEIVER_LAT, RECEIVER_LON, plane.lat, plane.lon)
        const slant = slantRangeKm(groundKm, plane.alt_baro)

        const sections = [
          {
            title: 'Quota',
            icon: '↕',
            tiles: [
              { label: 'Alt. barometrica', value: formatAlt(plane.alt_baro), sub: formatAltSub(plane.alt_baro), tooltip: 'Quota barometrica: misurata dalla pressione atmosferica, usata per la separazione del traffico aereo.' },
              { label: 'Alt. geometrica', value: formatAlt(plane.alt_geom), sub: formatAltSub(plane.alt_geom), tooltip: 'Quota GPS geometrica: misurata dai satelliti, più precisa dell\'altitudine barometrica.' },
              { label: 'Nav. MCP', value: plane.nav_altitude_mcp != null ? formatAlt(plane.nav_altitude_mcp) : null, tooltip: 'Mode Control Panel: quota impostata sul pannello dell\'autopilota dal pilota.' },
              { label: 'Nav. FMS', value: plane.nav_altitude_fms != null ? formatAlt(plane.nav_altitude_fms) : null, tooltip: 'Flight Management System: quota target calcolata dal computer di bordo per il piano di volo.' },
            ],
          },
          {
            title: 'Velocità',
            icon: '⚡',
            tiles: [
              { label: 'GS', value: formatSpeed(plane.gs), sub: formatSpeedSub(plane.gs), tooltip: 'Ground Speed: velocità dell\'aereo rispetto al suolo (include l\'effetto del vento).' },
              { label: 'IAS', value: plane.ias != null ? `${plane.ias} kt` : null, sub: plane.ias != null ? `${Math.round(plane.ias * 1.852)} km/h` : null, tooltip: 'Indicated Airspeed: velocità indicata dallo strumento di bordo (non corregge densità aria).' },
              { label: 'TAS', value: plane.tas != null ? `${plane.tas} kt` : null, sub: plane.tas != null ? `${Math.round(plane.tas * 1.852)} km/h` : null, tooltip: 'True Airspeed: velocità reale rispetto all\'aria, corretta per altitudine e temperatura.' },
              { label: 'Mach', value: plane.mach != null ? plane.mach.toFixed(2) : null, tooltip: 'Numero di Mach: rapporto tra la velocità dell\'aereo e la velocità del suono in quel momento.' },
            ],
          },
          {
            title: 'Navigazione',
            icon: '🧭',
            tiles: [
              { label: 'Heading vero', value: plane.true_heading != null ? `${Math.round(plane.true_heading)}°` : null, tooltip: 'Direzione in cui punta il muso dell\'aereo rispetto al Nord geografico (poli).' },
              { label: 'Heading mag.', value: plane.mag_heading != null ? `${Math.round(plane.mag_heading)}°` : null, tooltip: 'Direzione in cui punta il muso rispetto al Nord magnetico (usato nelle carte aeronautiche).' },
              { label: 'Nav. heading', value: plane.nav_heading != null ? `${Math.round(plane.nav_heading)}°` : null, tooltip: 'Heading target impostato sull\'autopilota.' },
              { label: 'Roll', value: plane.roll != null ? `${plane.roll.toFixed(1)}°` : null, tooltip: 'Angolo di rollio (inclinazione laterale). Positivo = inclinato a destra.' },
            ],
          },
          {
            title: 'Posizione',
            icon: '📍',
            tiles: [
              { label: 'Dist. orizzontale', value: formatDist(groundKm), tooltip: 'Distanza orizzontale (proiezione a terra) tra il receiver e l\'aereo.' },
              { label: 'Dist. reale', value: formatDist(slant), tooltip: 'Distanza in linea d\'aria 3D calcolata con il teorema di Pitagora: √(dist_orizzontale² + quota²).' },
              { label: 'Latitudine', value: plane.lat?.toFixed(5), tooltip: 'Coordinata GPS latitudine.' },
              { label: 'Longitudine', value: plane.lon?.toFixed(5), tooltip: 'Coordinata GPS longitudine.' },
            ],
          },
          {
            title: 'Meteo',
            icon: '🌡',
            tiles: [
              { label: 'Vento', value: plane.wind_speed != null ? `${plane.wind_speed} kt` : null, sub: plane.wind_dir != null ? `dir. ${plane.wind_dir}°` : null, tooltip: 'Velocità e direzione del vento stimata dall\'aereo (differenza tra TAS e GS).' },
              { label: 'OAT', value: plane.oat != null ? `${plane.oat} °C` : null, tooltip: 'Outside Air Temperature: temperatura esterna rilevata dai sensori dell\'aereo.' },
              { label: 'TAT', value: plane.tat != null ? `${plane.tat} °C` : null, tooltip: 'Total Air Temperature: temperatura che include il riscaldamento aerodinamico alla velocità di volo.' },
            ],
          },
          {
            title: 'Segnale',
            icon: '📡',
            tiles: [
              { label: 'RSSI', value: plane.rssi != null ? `${plane.rssi.toFixed(1)} dB` : null, tooltip: 'Received Signal Strength Indicator: potenza del segnale ricevuto. Più vicino allo 0 = segnale più forte.' },
              { label: 'Messaggi', value: plane.messages?.toLocaleString() ?? null, tooltip: 'Numero totale di messaggi ADS-B ricevuti da questo aereo da quando è nel range.' },
              { label: 'Tipo sorgente', value: plane.type ?? null, tooltip: 'Come è stata ottenuta la posizione: adsb_icao = segnale diretto, mlat = multilaterazione, tisb = ritrasmesso da terra.' },
              { label: 'Categoria', value: plane.category ?? null, tooltip: 'Categoria ADS-B: A1=piccolo, A2=medio, A3=pesante (>136t), A5=altissima velocità, B=rotante, C=aliante...' },
              { label: 'Visto', value: plane.seen != null ? `${plane.seen.toFixed(0)}s fa` : null, tooltip: 'Secondi dall\'ultimo messaggio ricevuto da questo aereo.' },
              { label: 'Pos. vista', value: plane.seen_pos != null ? `${plane.seen_pos.toFixed(0)}s fa` : null, tooltip: 'Secondi dall\'ultimo messaggio con coordinate GPS ricevuto.' },
            ],
          },
        ]

        return <DetailSections sections={sections} />
      })()}
      {plane.emergency && plane.emergency !== 'none' && (
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: 'var(--r-md)',
          background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.4)',
          fontSize: 13, fontWeight: 700, color: 'var(--red)',
        }}>⚠️ Emergenza: {plane.emergency}</div>
      )}
    </div>
  )
}

export default function App() {
  const { planes, lastUpdate, error } = usePlanes()
  const known = useKnown()
  const [selectedHex, setSelectedHex] = useState(null)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const { getTrail } = useTrails(planes, selectedHex)
  const [dbStats, setDbStats] = useState(null)

  // Planes that have DB history but are no longer in the live feed
  const liveHexSet = new Set(planes.map((p) => p.hex))
  const historicalPlanes = known
    .filter((k) => !liveHexSet.has(k.hex) && k.last_lat != null && k.last_lon != null)
    .map((k) => ({
      hex: k.hex,
      flight: k.flight,
      lat: k.last_lat,
      lon: k.last_lon,
      alt_baro: k.last_alt_baro,
      gs: k.last_gs,
      track: k.last_track,
      squawk: k.last_squawk,
      category: k.last_category,
      last_seen: k.last_seen,
      _historical: true,
    }))

  useEffect(() => {
    async function fetchStats() {
      try {
        const r = await fetch('/api/stats')
        if (r.ok) setDbStats(await r.json())
      } catch {}
    }
    fetchStats()
    const t = setInterval(fetchStats, 15000)
    return () => clearInterval(t)
  }, [])

  const selectedPlane = planes.find((p) => p.hex === selectedHex)
    ?? historicalPlanes.find((p) => p.hex === selectedHex)
    ?? null

  function handleSelect(hex) {
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
          <RangeCircles lat={RECEIVER_LAT} lon={RECEIVER_LON} />
          {/* Home marker */}
          <CircleMarker
            center={[RECEIVER_LAT, RECEIVER_LON]}
            radius={7}
            pathOptions={{ color: '#fac123', weight: 2, fillColor: '#fac123', fillOpacity: 0.25 }}
          />
          {/* Trail solo per l'aereo selezionato */}
          {selectedPlane && (
            <TrailLine points={getTrail(selectedPlane.hex)} selected={true} />
          )}
          {planes.map((p) => (
            <PlaneMarker key={p.hex} plane={p} selected={p.hex === selectedHex} onClick={handleSelect} />
          ))}
          {historicalPlanes.map((p) => (
            <PlaneMarker key={`h-${p.hex}`} plane={p} selected={p.hex === selectedHex} onClick={handleSelect} historical={true} />
          ))}
          <FlyTo plane={selectedPlane} />
        </MapContainer>

        {/* Bottom panel grafici */}
        <BottomPanel plane={selectedPlane} onClose={() => setSelectedHex(null)} />
      </div>

      {/* Sidebar */}
      <aside style={{
        width: 340, display: 'flex', flexDirection: 'column',
        gap: 12, padding: 16, overflowY: 'scroll',
        flexShrink: 0, background: 'transparent',
        height: '100vh',
      }}>

        {/* Header */}
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>HydraPlanes</div>
            <div style={{ fontSize: 11, color: error ? 'var(--red)' : 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
              {error ? '⚠ offline' : timeStr}
            </div>
          </div>
          <div style={{ ...cardInner, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Aerei visibili</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{error ? '—' : String(planes.length)}</div>
          </div>
        </div>

        {/* Detail panel (solo quando selezionato dalla lista) */}
        {selectedPlane && (
          <FullDetail plane={selectedPlane} onClose={() => setSelectedHex(null)} />
        )}

        {/* Voli */}
        <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Live header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Voli live</span>
            {selectedHex && planes.find(p => p.hex === selectedHex) && (
              <button onClick={() => setSelectedHex(null)} style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>Deseleziona</button>
            )}
          </div>
          {/* Live list — max 5 rows (~72px each) */}
          <div style={{ overflowY: 'auto', maxHeight: 380, flexShrink: 0 }}>
            <FlightList
              planes={planes}
              historicalPlanes={[]}
              selected={selectedHex}
              onSelect={handleSelect}
              receiverLat={RECEIVER_LAT}
              receiverLon={RECEIVER_LON}
            />
          </div>

          {/* Divider */}
          {historicalPlanes.length > 0 && (
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 16px', flexShrink: 0 }} />
          )}

          {/* Storico recente header */}
          {historicalPlanes.length > 0 && (
            <div style={{ padding: '10px 16px 4px', flexShrink: 0, fontSize: 10, color: 'var(--text3)', letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 600 }}>
              Storico recente
            </div>
          )}
          {/* Last 5 historical — fixed, no scroll */}
          {historicalPlanes.length > 0 && (
            <FlightList
              planes={[]}
              historicalPlanes={historicalPlanes.slice(0, 5)}
              selected={selectedHex}
              onSelect={handleSelect}
              receiverLat={RECEIVER_LAT}
              receiverLon={RECEIVER_LON}
            />
          )}

          {/* Storico button */}
          <button
            onClick={() => setShowHistoryPanel(true)}
            style={{
              display: 'block', width: 'calc(100% - 32px)', margin: '4px 16px 16px',
              padding: '11px', borderRadius: 'var(--r-lg)', flexShrink: 0,
              background: 'var(--card-inner)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text2)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font)',
            }}
          >
            🕓 Storico ({historicalPlanes.length})
          </button>
        </div>
      </aside>

      {/* History panel overlay */}
      {showHistoryPanel && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowHistoryPanel(false)}>
          <div style={{
            width: 380, maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', borderRadius: 20,
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 12px' }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>Storico aerei ({historicalPlanes.length})</span>
              <button onClick={() => setShowHistoryPanel(false)} style={{
                background: 'var(--card-inner)', border: 'none', borderRadius: 20,
                color: 'var(--text2)', width: 28, height: 28, cursor: 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <FlightList
                planes={[]}
                historicalPlanes={historicalPlanes}
                selected={selectedHex}
                onSelect={(hex) => { handleSelect(hex); setShowHistoryPanel(false) }}
                receiverLat={RECEIVER_LAT}
                receiverLon={RECEIVER_LON}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
