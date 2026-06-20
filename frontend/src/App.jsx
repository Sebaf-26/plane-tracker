import { useState, useRef, useEffect, useCallback } from 'react'
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
import { getSpecial } from './specialCallsigns'
import WebhookSettings from './components/WebhookSettings'

const RECEIVER_LAT = import.meta.env.VITE_LAT ? parseFloat(import.meta.env.VITE_LAT) : 43.9
const RECEIVER_LON = import.meta.env.VITE_LON ? parseFloat(import.meta.env.VITE_LON) : 10.2

function FlyTo({ plane }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (plane && plane.hex !== prev.current && plane.lat != null && plane.lon != null) {
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
            title: 'Quota', icon: '↕',
            tiles: [
              { label: 'Alt. barometrica', value: formatAlt(plane.alt_baro), sub: formatAltSub(plane.alt_baro), tooltip: 'Quota barometrica: misurata dalla pressione atmosferica, usata per la separazione del traffico aereo.' },
              { label: 'Alt. geometrica', value: formatAlt(plane.alt_geom), sub: formatAltSub(plane.alt_geom), tooltip: 'Quota GPS geometrica: misurata dai satelliti, più precisa dell\'altitudine barometrica.' },
              { label: 'Nav. MCP', value: plane.nav_altitude_mcp != null ? formatAlt(plane.nav_altitude_mcp) : null, tooltip: 'Mode Control Panel: quota impostata sul pannello dell\'autopilota dal pilota.' },
              { label: 'Nav. FMS', value: plane.nav_altitude_fms != null ? formatAlt(plane.nav_altitude_fms) : null, tooltip: 'Flight Management System: quota target calcolata dal computer di bordo per il piano di volo.' },
            ],
          },
          {
            title: 'Velocità', icon: '⚡',
            tiles: [
              { label: 'GS', value: formatSpeed(plane.gs), sub: formatSpeedSub(plane.gs), tooltip: 'Ground Speed: velocità dell\'aereo rispetto al suolo (include l\'effetto del vento).' },
              { label: 'IAS', value: plane.ias != null ? `${plane.ias} kt` : null, sub: plane.ias != null ? `${Math.round(plane.ias * 1.852)} km/h` : null, tooltip: 'Indicated Airspeed: velocità indicata dallo strumento di bordo (non corregge densità aria).' },
              { label: 'TAS', value: plane.tas != null ? `${plane.tas} kt` : null, sub: plane.tas != null ? `${Math.round(plane.tas * 1.852)} km/h` : null, tooltip: 'True Airspeed: velocità reale rispetto all\'aria, corretta per altitudine e temperatura.' },
              { label: 'Mach', value: plane.mach != null ? plane.mach.toFixed(2) : null, tooltip: 'Numero di Mach: rapporto tra la velocità dell\'aereo e la velocità del suono in quel momento.' },
            ],
          },
          {
            title: 'Navigazione', icon: '🧭',
            tiles: [
              { label: 'Heading vero', value: plane.true_heading != null ? `${Math.round(plane.true_heading)}°` : null, tooltip: 'Direzione in cui punta il muso dell\'aereo rispetto al Nord geografico (poli).' },
              { label: 'Heading mag.', value: plane.mag_heading != null ? `${Math.round(plane.mag_heading)}°` : null, tooltip: 'Direzione in cui punta il muso rispetto al Nord magnetico (usato nelle carte aeronautiche).' },
              { label: 'Nav. heading', value: plane.nav_heading != null ? `${Math.round(plane.nav_heading)}°` : null, tooltip: 'Heading target impostato sull\'autopilota.' },
              { label: 'Roll', value: plane.roll != null ? `${plane.roll.toFixed(1)}°` : null, tooltip: 'Angolo di rollio (inclinazione laterale). Positivo = inclinato a destra.' },
            ],
          },
          {
            title: 'Posizione', icon: '📍',
            tiles: [
              { label: 'Dist. orizzontale', value: formatDist(groundKm), tooltip: 'Distanza orizzontale (proiezione a terra) tra il receiver e l\'aereo.' },
              { label: 'Dist. reale', value: formatDist(slant), tooltip: 'Distanza in linea d\'aria 3D calcolata con il teorema di Pitagora: √(dist_orizzontale² + quota²).' },
              { label: 'Latitudine', value: plane.lat?.toFixed(5), tooltip: 'Coordinata GPS latitudine.' },
              { label: 'Longitudine', value: plane.lon?.toFixed(5), tooltip: 'Coordinata GPS longitudine.' },
            ],
          },
          {
            title: 'Meteo', icon: '🌡',
            tiles: [
              { label: 'Vento', value: plane.wind_speed != null ? `${plane.wind_speed} kt` : null, sub: plane.wind_dir != null ? `dir. ${plane.wind_dir}°` : null, tooltip: 'Velocità e direzione del vento stimata dall\'aereo (differenza tra TAS e GS).' },
              { label: 'OAT', value: plane.oat != null ? `${plane.oat} °C` : null, tooltip: 'Outside Air Temperature: temperatura esterna rilevata dai sensori dell\'aereo.' },
              { label: 'TAT', value: plane.tat != null ? `${plane.tat} °C` : null, tooltip: 'Total Air Temperature: temperatura che include il riscaldamento aerodinamico alla velocità di volo.' },
            ],
          },
          {
            title: 'Segnale', icon: '📡',
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

function fmtDate(ts) {
  return new Date(ts * 1000).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function fmtDuration(startTs, endTs) {
  const s = endTs - startTs
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}min` : `${h}h`
}

// Pannello sessioni per un singolo hex (aerei speciali)
function SessionsList({ hex, selectedSessionId, onSelectSession }) {
  const [sessions, setSessions] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sessions/${hex}`)
      .then(r => r.json())
      .then(data => { setSessions(data); setLoading(false) })
      .catch(() => { setSessions([]); setLoading(false) })
  }, [hex])

  if (loading) return (
    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>Caricamento…</div>
  )
  if (!sessions?.length) return (
    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>Nessuna sessione trovata.</div>
  )

  return (
    <div style={{ paddingBottom: 4 }}>
      {sessions.map(s => {
        const isSelected = selectedSessionId === s.session_id
        return (
          <button
            key={s.session_id}
            onClick={() => onSelectSession(s.session_id, hex)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '9px 12px',
              background: isSelected ? 'rgba(250,193,35,0.12)' : 'transparent',
              border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 11, color: isSelected ? 'var(--accent)' : 'var(--text)', fontWeight: 600 }}>
                {fmtDate(s.first_ts)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                {fmtDuration(s.first_ts, s.last_ts)} · {s.points} punti
              </span>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
              background: isSelected ? 'rgba(250,193,35,0.15)' : 'rgba(255,255,255,0.06)',
              padding: '3px 7px', borderRadius: 6, flexShrink: 0,
              border: isSelected ? '1px solid rgba(250,193,35,0.3)' : '1px solid transparent',
            }}>
              {s.session_id}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function groupHistorical(planes) {
  const groups = {}
  for (const p of planes) {
    const sp = getSpecial(p.flight)
    const key = sp ? sp.label : (() => {
      const cs = p.flight?.trim().toUpperCase() ?? ''
      return cs.length >= 3 ? cs.slice(0, 3) : (cs || p.hex.toUpperCase())
    })()
    if (!groups[key]) groups[key] = { label: key, color: sp?.color ?? null, isSpecial: !!sp, planes: [] }
    groups[key].planes.push(p)
  }
  return Object.values(groups).sort((a, b) => {
    if (a.isSpecial !== b.isSpecial) return a.isSpecial ? -1 : 1
    return a.label.localeCompare(b.label)
  })
}

function HistoryPanel({ historicalPlanes, selectedHex, selectedSessionId, preExpandHex, onSelect, onSelectSession, onClose, receiverLat, receiverLon }) {
  const groups = groupHistorical(historicalPlanes)
  const [expandedHex, setExpandedHex] = useState(preExpandHex ?? null)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: 400, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', borderRadius: 20,
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 12px' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Storico aerei ({historicalPlanes.length})</span>
          <button onClick={onClose} style={{
            background: 'var(--card-inner)', border: 'none', borderRadius: 20,
            color: 'var(--text2)', width: 28, height: 28, cursor: 'pointer',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {selectedSessionId && (
          <div style={{
            margin: '0 12px 10px',
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(250,193,35,0.1)', border: '1px solid rgba(250,193,35,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
              Sessione attiva:
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>
              {selectedSessionId}
            </span>
            <button onClick={() => onSelectSession(null, null)} style={{
              background: 'none', border: 'none', color: 'var(--text3)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)',
            }}>✕ rimuovi</button>
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 12px 16px' }}>
          {groups.map(g => (
            <div key={g.label} style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                color: g.color ?? 'var(--text3)',
                padding: '8px 4px 4px',
                borderBottom: `1px solid ${g.color ? `${g.color}33` : 'rgba(255,255,255,0.06)'}`,
                marginBottom: 6,
              }}>
                {g.label} ({g.planes.length})
              </div>

              {g.isSpecial
                ? g.planes.map(p => (
                    <div key={p.hex} style={{ marginBottom: 4 }}>
                      {/* Riga piano speciale */}
                      <button
                        onClick={() => setExpandedHex(prev => prev === p.hex ? null : p.hex)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '9px 10px',
                          background: expandedHex === p.hex ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: expandedHex === p.hex ? '8px 8px 0 0' : 8,
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: g.color ?? 'var(--text)' }}>
                            {p.flight?.trim() || p.hex.toUpperCase()}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                            {p.hex.toUpperCase()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Sessioni</span>
                          <span style={{
                            fontSize: 10, color: 'var(--text3)',
                            transform: expandedHex === p.hex ? 'rotate(0deg)' : 'rotate(-90deg)',
                            display: 'inline-block', transition: 'transform 0.2s',
                          }}>▾</span>
                        </div>
                      </button>

                      {/* Lista sessioni espansa */}
                      {expandedHex === p.hex && (
                        <div style={{
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderTop: 'none',
                          borderRadius: '0 0 8px 8px',
                          overflow: 'hidden',
                        }}>
                          <SessionsList
                            hex={p.hex}
                            selectedSessionId={selectedSessionId}
                            onSelectSession={(sid, hex) => {
                              onSelectSession(sid, hex)
                              onClose()
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))
                : (
                  <FlightList
                    planes={[]}
                    historicalPlanes={g.planes}
                    selected={selectedHex}
                    onSelect={(hex) => { onSelect(hex); onClose() }}
                    receiverLat={receiverLat}
                    receiverLon={receiverLon}
                  />
                )
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { planes, lastUpdate, error } = usePlanes()
  const known = useKnown()
  const [selectedHex, setSelectedHex] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)  // { id, hex } | null
  const [sessionTrail, setSessionTrail] = useState([])
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [showHistorical, setShowHistorical] = useState(false)
  const [histSliderHours, setHistSliderHours] = useState(0) // 0 = ora, 24 = 24h fa
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 900
  const { getTrail } = useTrails(planes, selectedHex)
  const [dbStats, setDbStats] = useState(null)
  const [showWebhookSettings, setShowWebhookSettings] = useState(false)
  const [historyPanelPreExpand, setHistoryPanelPreExpand] = useState(null)

  // Carica sessione da URL hash al mount
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#s=')) {
      const sid = hash.slice(3)
      loadSession(sid)
    }
  }, [])

  function loadSession(sid) {
    fetch(`/api/session/${sid}/info`)
      .then(r => r.ok ? r.json() : null)
      .then(info => {
        if (!info) return
        setSelectedSession({ id: sid, hex: info.hex })
        setSelectedHex(info.hex)
        window.location.hash = `s=${sid}`
        // Carica trail della sessione
        return fetch(`/api/session/${sid}/trail`).then(r => r.json())
      })
      .then(pts => { if (pts) setSessionTrail(pts) })
      .catch(() => {})
  }

  function handleSelectSession(sid, hex) {
    if (!sid) {
      // rimuovi selezione sessione
      setSelectedSession(null)
      setSessionTrail([])
      history.pushState('', document.title, window.location.pathname + window.location.search)
      return
    }
    setSelectedSession({ id: sid, hex })
    setSelectedHex(hex)
    window.location.hash = `s=${sid}`
    fetch(`/api/session/${sid}/trail`)
      .then(r => r.json())
      .then(pts => setSessionTrail(pts))
      .catch(() => setSessionTrail([]))
  }

  const liveHexSet = new Set(planes.map((p) => p.hex))
  const nowS = Math.floor(Date.now() / 1000)
  const histWindowEnd = nowS - histSliderHours * 3600
  const histWindowStart = histWindowEnd - 2 * 3600
  const historicalPlanes = known
    .filter((k) => !liveHexSet.has(k.hex) && k.last_lat != null && k.last_lon != null
      && k.last_seen >= histWindowStart && k.last_seen <= histWindowEnd)
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
    // Aereo speciale storico → apri pannello sessioni invece di caricare il trail
    const histPlane = historicalPlanes.find(p => p.hex === hex)
    if (histPlane && getSpecial(histPlane.flight)) {
      setHistoryPanelPreExpand(hex)
      setShowHistoryPanel(true)
      return
    }
    setSelectedHex((prev) => (prev === hex ? null : hex))
    setSelectedSession(prev => (prev && prev.hex !== hex) ? null : prev)
    if (!selectedSession || selectedSession.hex !== hex) setSessionTrail([])
  }

  const timeStr = lastUpdate?.toLocaleTimeString('it-IT', { hour12: false }) ?? '--:--:--'

  // Trail da mostrare: sessione specifica se selezionata, altrimenti trail live
  const trailPoints = selectedSession ? sessionTrail : (selectedPlane ? getTrail(selectedPlane.hex) : [])

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', overflow: 'hidden' }}>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <MapContainer center={[RECEIVER_LAT, RECEIVER_LON]} zoom={8} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            maxZoom={19}
          />
          <RangeCircles lat={RECEIVER_LAT} lon={RECEIVER_LON} />
          <CircleMarker
            center={[RECEIVER_LAT, RECEIVER_LON]}
            radius={7}
            pathOptions={{ color: '#fac123', weight: 2, fillColor: '#fac123', fillOpacity: 0.25 }}
          />
          {selectedPlane && (
            <TrailLine points={trailPoints} selected={true} />
          )}
          {/* Focus mode: se c'è una sessione attiva mostra solo quell'aereo */}
          {selectedSession ? (
            selectedPlane && selectedPlane.lat != null && selectedPlane.lon != null && (
              <PlaneMarker plane={selectedPlane} selected={true} onClick={handleSelect} historical={!!selectedPlane._historical} />
            )
          ) : (
            <>
              {planes.filter(p => p.lat != null && p.lon != null && isFinite(p.lat) && isFinite(p.lon)).map((p) => (
                <PlaneMarker key={p.hex} plane={p} selected={p.hex === selectedHex} onClick={handleSelect} />
              ))}
              {showHistorical && historicalPlanes.filter(p => p.lat != null && p.lon != null && isFinite(p.lat) && isFinite(p.lon)).map((p) => (
                <PlaneMarker key={`h-${p.hex}`} plane={p} selected={p.hex === selectedHex} onClick={handleSelect} historical={true} />
              ))}
            </>
          )}
          <FlyTo plane={selectedPlane} />
        </MapContainer>

        {/* Controlli mappa — colonna top-right */}
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 1100,
          display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
        }}>
          {/* Toggle storico */}
          <button
            onClick={() => setShowHistorical(v => !v)}
            style={{
              padding: '7px 13px', borderRadius: 20,
              background: showHistorical ? 'rgba(250,193,35,0.18)' : 'rgba(30,30,40,0.85)',
              border: `1.5px solid ${showHistorical ? 'rgba(250,193,35,0.5)' : 'rgba(255,255,255,0.15)'}`,
              color: showHistorical ? 'var(--accent)' : 'var(--text3)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font)', backdropFilter: 'blur(8px)',
              whiteSpace: 'nowrap',
            }}
          >
            🕓 Storico {showHistorical ? 'ON' : 'OFF'}
          </button>

          {/* Badge sessione attiva */}
          {selectedSession && (
            <button
              onClick={() => { setSelectedSession(null); setSessionTrail([]); setSelectedHex(null); history.pushState('', document.title, window.location.pathname) }}
              style={{
                padding: '6px 13px', borderRadius: 14,
                background: 'rgba(250,193,35,0.15)',
                border: '1.5px solid rgba(250,193,35,0.4)',
                fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                fontFamily: 'var(--font-mono)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontFamily: 'var(--font)', fontWeight: 400, opacity: 0.7, fontSize: 10 }}>sessione</span>
              {selectedSession.id}
              <span style={{ fontFamily: 'var(--font)', fontWeight: 600, fontSize: 10, opacity: 0.7 }}>✕ esci</span>
            </button>
          )}
        </div>

        {/* Slider temporale storico */}
        {showHistorical && (
          <div style={{
            position: 'absolute',
            bottom: isMobile ? 80 : 32,
            left: isMobile ? 12 : '50%',
            right: isMobile ? 12 : 'auto',
            transform: isMobile ? 'none' : 'translateX(-50%)',
            zIndex: 1100, background: 'rgba(20,20,30,0.92)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
            padding: '10px 16px',
            width: isMobile ? 'auto' : 340,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
              <span>ora</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                {histSliderHours === 0 ? 'ultimi 2h' : `da -${histSliderHours + 2}h a -${histSliderHours}h`}
              </span>
              <span>-24h</span>
            </div>
            <input
              type="range" min={0} max={22} step={1}
              value={histSliderHours}
              onChange={e => setHistSliderHours(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', height: 28 }}
            />
          </div>
        )}

        <BottomPanel
          plane={selectedPlane}
          sessionId={selectedSession?.id}
          onClose={() => { setSelectedHex(null); setSelectedSession(null); setSessionTrail([]) }}
        />

        {isMobile && (
          <button
            onClick={() => setSidebarOpen(v => !v)}
            style={{
              position: 'absolute', bottom: selectedPlane ? 220 : 16, right: 16, zIndex: 1100,
              width: 52, height: 52, borderRadius: '50%',
              background: '#111827', border: '1.5px solid rgba(255,255,255,0.15)',
              color: 'white', fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}
          >☰</button>
        )}
      </div>

      {(!isMobile || sidebarOpen) && isMobile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)} />
      )}
      <aside style={isMobile ? {
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2001,
        maxHeight: '75vh', display: 'flex', flexDirection: 'column',
        gap: 12, padding: 16, overflowY: 'auto',
        background: '#0d1117',
        borderRadius: '20px 20px 0 0',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
        transform: sidebarOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease',
      } : {
        width: 340, display: 'flex', flexDirection: 'column',
        gap: 12, padding: 16, overflowY: 'scroll',
        flexShrink: 0, background: 'transparent',
        height: '100vh',
      }}>

        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, marginTop: -4 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
          </div>
        )}

        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>HydraPlanes</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 11, color: error ? 'var(--red)' : 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                {error ? '⚠ offline' : timeStr}
              </div>
              <button
                onClick={() => setShowWebhookSettings(true)}
                title="Impostazioni webhook"
                style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.07)',
                  color: 'var(--text3)', fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >🔔</button>
            </div>
          </div>
          <div style={{ ...cardInner, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>Aerei in tempo reale</span>
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>{error ? '—' : String(planes.length)}</span>
          </div>
        </div>

        {selectedPlane && (
          <FullDetail plane={selectedPlane} onClose={() => { setSelectedHex(null); setSelectedSession(null); setSessionTrail([]) }} />
        )}

        <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Voli live</span>
            {selectedHex && planes.find(p => p.hex === selectedHex) && (
              <button onClick={() => setSelectedHex(null)} style={{
                background: 'none', border: 'none', color: 'var(--accent)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>Deseleziona</button>
            )}
          </div>
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

          {historicalPlanes.length > 0 && (
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 16px', flexShrink: 0 }} />
          )}

          {historicalPlanes.length > 0 && (
            <div style={{ padding: '10px 16px 4px', flexShrink: 0, fontSize: 10, color: 'var(--text3)', letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 600 }}>
              Storico recente
            </div>
          )}
          {historicalPlanes.length > 0 && (
            <FlightList
              planes={[]}
              historicalPlanes={historicalPlanes.slice(0, 4)}
              selected={selectedHex}
              onSelect={handleSelect}
              receiverLat={RECEIVER_LAT}
              receiverLon={RECEIVER_LON}
            />
          )}

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

      {showWebhookSettings && (
        <WebhookSettings onClose={() => setShowWebhookSettings(false)} />
      )}

      {showHistoryPanel && (
        <HistoryPanel
          historicalPlanes={historicalPlanes}
          selectedHex={selectedHex}
          selectedSessionId={selectedSession?.id ?? null}
          preExpandHex={historyPanelPreExpand}
          onSelect={handleSelect}
          onSelectSession={handleSelectSession}
          onClose={() => { setShowHistoryPanel(false); setHistoryPanelPreExpand(null) }}
          receiverLat={RECEIVER_LAT}
          receiverLon={RECEIVER_LON}
        />
      )}
    </div>
  )
}
