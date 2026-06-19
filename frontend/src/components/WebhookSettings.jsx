import { useState, useEffect } from 'react'

const CALLSIGN_GROUPS = [
  {
    label: 'Elisoccorso',
    color: '#ff453a',
    prefixes: ['PEGASO', 'PGSO', 'PELIKA', 'PELIC', 'INSUB', 'GRIFO', 'NIKO', 'HEMS'],
  },
  {
    label: 'Polizia / Carabinieri',
    color: '#64d2ff',
    prefixes: ['CC', 'POLI', 'VOLPE', 'VOLP', 'DRAGO', 'DRG', 'KOALA', 'KLA', 'CP'],
  },
  {
    label: 'Guardia di Finanza',
    color: '#ffd60a',
    prefixes: ['FIAMMA', 'FIAA', 'GABBIA', 'GABBN'],
  },
  {
    label: 'Vigili del Fuoco',
    color: '#ff9f0a',
    prefixes: ['VF', 'VVF'],
  },
  {
    label: 'Aeronautica / Marina',
    color: '#30d158',
    prefixes: ['AMI', 'MARINA', 'MM', 'PONY', 'ICARO', 'RESCUE'],
  },
]

const PAYLOAD_FIELDS = [
  { key: 'include_callsign',   label: 'Callsign',             desc: 'es. PEGASO51' },
  { key: 'include_hex',        label: 'Codice ICAO (hex)',    desc: 'es. 3005A2' },
  { key: 'include_position',   label: 'Posizione GPS',        desc: 'lat / lon' },
  { key: 'include_distance',   label: 'Distanza dal receiver', desc: 'km' },
  { key: 'include_altitude',   label: 'Quota',                desc: 'ft e m' },
  { key: 'include_speed',      label: 'Velocità',             desc: 'kt e km/h' },
  { key: 'include_track',      label: 'Rotta',                desc: 'gradi' },
  { key: 'include_squawk',     label: 'Squawk',               desc: 'codice transponder' },
  { key: 'include_photo',      label: 'Foto + dati aereo',    desc: 'immagine, tipo, operatore' },
  { key: 'include_map_link',   label: 'Link mappa',           desc: 'URL diretto alla sessione' },
  { key: 'include_session_id', label: 'Session ID',           desc: 'codice univoco sessione' },
]

const DEFAULT_CONFIG = {
  enabled: false,
  url: '',
  cooldown_min: 30,
  max_distance_km: null,
  trigger_new_session: true,
  callsign_prefixes: [],
  include_callsign: true,
  include_hex: true,
  include_position: true,
  include_altitude: true,
  include_speed: true,
  include_track: false,
  include_squawk: false,
  include_photo: true,
  include_map_link: true,
  include_session_id: true,
  include_distance: true,
}

function Toggle({ value, onChange, label, accent }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font)', textAlign: 'left', padding: 0,
      }}
    >
      <div style={{
        width: 36, height: 20, borderRadius: 10, position: 'relative',
        background: value ? (accent ?? 'var(--accent)') : 'rgba(255,255,255,0.15)',
        transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </div>
      {label && <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>}
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 12,
    }}>
      <div style={{
        padding: '10px 14px', fontSize: 10, fontWeight: 700,
        letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text3)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>{title}</div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  )
}

export default function WebhookSettings({ onClose }) {
  const [cfg, setCfg] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)  // { ok: bool, message: string } | null
  const [customPrefix, setCustomPrefix] = useState('')

  useEffect(() => {
    fetch('/api/webhook/config')
      .then(r => r.json())
      .then(data => { setCfg({ ...DEFAULT_CONFIG, ...data }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function set(key, val) {
    setCfg(prev => ({ ...prev, [key]: val }))
  }

  function togglePrefix(prefix) {
    setCfg(prev => {
      const cur = prev.callsign_prefixes ?? []
      return {
        ...prev,
        callsign_prefixes: cur.includes(prefix)
          ? cur.filter(p => p !== prefix)
          : [...cur, prefix],
      }
    })
  }

  function addCustomPrefix() {
    const p = customPrefix.trim().toUpperCase()
    if (!p) return
    setCfg(prev => ({
      ...prev,
      callsign_prefixes: prev.callsign_prefixes.includes(p)
        ? prev.callsign_prefixes
        : [...prev.callsign_prefixes, p],
    }))
    setCustomPrefix('')
  }

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/webhook/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch('/api/webhook/test', { method: 'POST' })
      const body = await r.json().catch(() => ({}))
      setTestResult({ ok: r.ok, message: body.message || body.detail || '' })
    } catch {
      setTestResult({ ok: false, message: 'Errore di rete' })
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 6000)
    }
  }

  const prefixes = cfg.callsign_prefixes ?? []

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        width: 480, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', borderRadius: 20,
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Notifiche Webhook</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Invia dati a n8n → Telegram quando passa un aereo speciale
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 20,
            color: 'var(--text2)', width: 28, height: 28, cursor: 'pointer',
            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Caricamento…</div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px 16px 0' }}>

            {/* Attiva / URL */}
            <Section title="Configurazione webhook">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Toggle value={cfg.enabled} onChange={v => set('enabled', v)} label="Abilita notifiche" accent="#30d158" />
                {cfg.enabled && (
                  <span style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(48,209,88,0.15)', color: '#30d158',
                    border: '1px solid rgba(48,209,88,0.3)', fontWeight: 600,
                  }}>ATTIVO</span>
                )}
              </div>
              <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--text3)' }}>URL Webhook (n8n)</div>
              <input
                value={cfg.url}
                onChange={e => set('url', e.target.value)}
                placeholder="https://n8n.tuodominio.com/webhook/abc123"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '9px 12px',
                  color: 'var(--text)', fontSize: 12,
                  fontFamily: 'var(--font-mono)', outline: 'none',
                }}
              />
            </Section>

            {/* Quando notificare */}
            <Section title="Quando notificare">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <Toggle
                  value={cfg.trigger_new_session}
                  onChange={v => set('trigger_new_session', v)}
                  label="Nuova sessione di volo (prima comparsa o ricomparsa dopo inattività)"
                />

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                    Cooldown — non ripetere la stessa notifica per
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="range" min={5} max={240} step={5}
                      value={cfg.cooldown_min}
                      onChange={e => set('cooldown_min', Number(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--accent)' }}
                    />
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: 'var(--accent)',
                      minWidth: 50, textAlign: 'right',
                    }}>
                      {cfg.cooldown_min >= 60
                        ? `${Math.floor(cfg.cooldown_min / 60)}h${cfg.cooldown_min % 60 ? ` ${cfg.cooldown_min % 60}min` : ''}`
                        : `${cfg.cooldown_min}min`}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Toggle
                      value={cfg.max_distance_km != null}
                      onChange={v => set('max_distance_km', v ? 50 : null)}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>
                      Solo se entro
                      {cfg.max_distance_km != null && (
                        <strong style={{ color: 'var(--accent)', margin: '0 4px' }}>
                          {cfg.max_distance_km} km
                        </strong>
                      )}
                      dal receiver
                    </span>
                  </div>
                  {cfg.max_distance_km != null && (
                    <input
                      type="range" min={5} max={300} step={5}
                      value={cfg.max_distance_km}
                      onChange={e => set('max_distance_km', Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent)' }}
                    />
                  )}
                </div>
              </div>
            </Section>

            {/* Callsign monitorati */}
            <Section title="Callsign monitorati">
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                Se nessuno è selezionato, vengono monitorati tutti gli aerei speciali.
              </div>

              {CALLSIGN_GROUPS.map(g => (
                <div key={g.label} style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: g.color,
                    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
                  }}>{g.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {g.prefixes.map(p => {
                      const active = prefixes.includes(p)
                      return (
                        <button
                          key={p}
                          onClick={() => togglePrefix(p)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 11,
                            fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'var(--font-mono)',
                            background: active ? `${g.color}22` : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${active ? g.color : 'rgba(255,255,255,0.1)'}`,
                            color: active ? g.color : 'var(--text3)',
                            transition: 'all 0.15s',
                          }}
                        >{p}</button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Custom prefix */}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  value={customPrefix}
                  onChange={e => setCustomPrefix(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addCustomPrefix()}
                  placeholder="Prefisso custom (es. NINOX)"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                    padding: '7px 10px', color: 'var(--text)', fontSize: 12,
                    fontFamily: 'var(--font-mono)', outline: 'none',
                  }}
                />
                <button
                  onClick={addCustomPrefix}
                  style={{
                    padding: '0 14px', borderRadius: 8, border: 'none',
                    background: 'rgba(255,255,255,0.1)', color: 'var(--text)',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >+</button>
              </div>

              {/* Custom prefixes badges */}
              {prefixes.filter(p => !CALLSIGN_GROUPS.flatMap(g => g.prefixes).includes(p)).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {prefixes
                    .filter(p => !CALLSIGN_GROUPS.flatMap(g => g.prefixes).includes(p))
                    .map(p => (
                      <button
                        key={p}
                        onClick={() => togglePrefix(p)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11,
                          fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(191,90,242,0.15)',
                          border: '1px solid rgba(191,90,242,0.4)',
                          color: '#bf5af2',
                        }}
                      >{p} ×</button>
                    ))}
                </div>
              )}
            </Section>

            {/* Dati nel payload */}
            <Section title="Dati inclusi nel payload">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {PAYLOAD_FIELDS.map(f => (
                  <div key={f.key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '8px 10px', borderRadius: 8,
                    background: cfg[f.key] ? 'rgba(250,193,35,0.07)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${cfg[f.key] ? 'rgba(250,193,35,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    cursor: 'pointer',
                  }} onClick={() => set(f.key, !cfg[f.key])}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                      background: cfg[f.key] ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                      border: `1.5px solid ${cfg[f.key] ? 'var(--accent)' : 'rgba(255,255,255,0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {cfg[f.key] && <span style={{ fontSize: 9, color: '#000', fontWeight: 900 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{f.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Esempio payload */}
            <Section title="Esempio payload JSON">
              <pre style={{
                fontSize: 10, color: 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--font-mono)', margin: 0, lineHeight: 1.6,
                overflowX: 'auto', whiteSpace: 'pre-wrap',
              }}>{JSON.stringify({
                evento: 'aereo_speciale_rilevato',
                timestamp: new Date().toISOString(),
                ...(cfg.include_callsign    && { callsign: 'PEGASO51' }),
                ...(cfg.include_hex         && { hex: '3005A2' }),
                ...(cfg.include_session_id  && { session_id: 'a3k7m2p' }),
                ...(cfg.include_position    && { lat: 45.123, lon: 7.456 }),
                ...(cfg.include_distance    && { distanza_km: 12.3 }),
                ...(cfg.include_altitude    && { quota_ft: 2500, quota_m: 762 }),
                ...(cfg.include_speed       && { velocita_kt: 120, velocita_kmh: 222 }),
                ...(cfg.include_track       && { rotta: 270 }),
                ...(cfg.include_squawk      && { squawk: '7000' }),
                ...(cfg.include_photo       && { foto_url: 'https://cdn.adsbdb.com/...', registrazione: 'I-HHSS', tipo_aereo: 'AW139' }),
                ...(cfg.include_map_link    && { mappa_url: 'https://hydraplane.…/#s=a3k7m2p' }),
              }, null, 2)}</pre>
            </Section>

            <div style={{ height: 16 }} />
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={test}
            disabled={!cfg.url || testing}
            style={{
              flex: 1, padding: '10px', borderRadius: 10, border: 'none',
              background: testResult?.ok ? 'rgba(48,209,88,0.2)'
                        : testResult ? 'rgba(255,69,58,0.2)'
                        : 'rgba(255,255,255,0.08)',
              color: testResult?.ok ? '#30d158'
                   : testResult ? '#ff453a'
                   : 'var(--text2)',
              fontSize: 13, fontWeight: 600, cursor: cfg.url ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font)', opacity: cfg.url ? 1 : 0.4,
            }}
          >
            {testing
            ? 'Invio…'
            : testResult
              ? (testResult.ok ? `✓ ${testResult.message}` : `✗ ${testResult.message}`)
              : 'Test — ultimo PEGASO reale'}
          </button>
          <button
            onClick={async () => { await save(); onClose() }}
            disabled={saving}
            style={{
              flex: 2, padding: '10px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#000',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font)', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Salvataggio…' : 'Salva impostazioni'}
          </button>
        </div>
      </div>
    </div>
  )
}
