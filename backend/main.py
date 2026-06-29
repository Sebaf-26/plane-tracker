import asyncio
import hashlib
import json
import math
import sqlite3
import time
import os
import contextlib
from datetime import datetime, timezone

import logging
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("hydra")

ULTRAFEEDER_URL = os.getenv("ULTRAFEEDER_URL", "http://ultrafeeder/data/aircraft.json")
DB_PATH = os.getenv("DB_PATH", "/data/hydra.db")
RETAIN_S = int(os.getenv("RETAIN_MINUTES", "10")) * 60
RETAIN_HEMS_S = 7 * 24 * 3600
RETAIN_AIRCRAFT_S = int(os.getenv("RETAIN_AIRCRAFT_HOURS", "24")) * 3600
POLL_S = 2
GAP_S = 600

RECEIVER_LAT = float(os.getenv("RECEIVER_LAT") or "0")
RECEIVER_LON = float(os.getenv("RECEIVER_LON") or "0")
SITE_URL = os.getenv("SITE_URL", "")  # es. https://hydraplane.nove1uno.uk

SPECIAL_PREFIXES = [
    "PEGASO", "PGSO", "PELIKA", "PELIC", "INSUB", "GRIFO", "NIKO", "HEMS",
    "VOLPE", "VOLP", "POLI", "FIAMMA", "FIAA", "CC",
    "DRAGO", "DRG", "VF", "VVF",
    "KOALA", "KLA", "CP", "GABBIA", "GABBN",
    "ICARO", "RESCUE", "AMI",
    "MARINA", "MM",
    "PONY",
]

# Prefissi corti che richiedono una cifra subito dopo per evitare falsi positivi:
# CC → CCM = Air Corsica | MM → MMA ecc. | CP → CPA = Cathay Pacific | VF → VFR ecc.
_DIGIT_REQUIRED = {"CC", "MM", "CP", "VF"}

def is_special(flight):
    if not flight:
        return False
    f = flight.upper().strip()
    for p in SPECIAL_PREFIXES:
        if f.startswith(p):
            if p in _DIGIT_REQUIRED:
                next_ch = f[len(p):len(p)+1]
                if next_ch and not next_ch.isdigit():
                    continue
            return True
    return False

def is_pegaso(flight):
    if not flight:
        return False
    f = flight.upper().strip()
    return f.startswith("PEGASO") or f.startswith("PGSO")

def make_session_id(hex_code, ts):
    raw = f"{hex_code}:{ts}"
    h = int(hashlib.md5(raw.encode()).hexdigest()[:8], 16)
    chars = '0123456789abcdefghjkmnpqrstvwxyz'
    result = ''
    for _ in range(7):
        result = chars[h % 32] + result
        h //= 32
    return result

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))

# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------

def get_db():
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

DEFAULT_WEBHOOK_CONFIG = {
    "enabled": 0,
    "url": "",
    "cooldown_min": 30,
    "max_distance_km": None,
    "trigger_new_session": 1,
    "callsign_prefixes": "[]",
    "include_callsign": 1,
    "include_hex": 1,
    "include_position": 1,
    "include_altitude": 1,
    "include_speed": 1,
    "include_track": 0,
    "include_squawk": 0,
    "include_photo": 1,
    "include_map_link": 1,
    "include_session_id": 1,
    "include_distance": 1,
}

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = get_db()
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript("""
        CREATE TABLE IF NOT EXISTS positions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ts          INTEGER NOT NULL,
            hex         TEXT NOT NULL,
            flight      TEXT,
            is_hems     INTEGER NOT NULL DEFAULT 0,
            session_id  TEXT,
            lat         REAL,
            lon         REAL,
            alt_baro    REAL,
            alt_geom    REAL,
            gs          REAL,
            ias         REAL,
            tas         REAL,
            mach        REAL,
            track       REAL,
            mag_heading REAL,
            true_heading REAL,
            baro_rate   REAL,
            geom_rate   REAL,
            squawk      TEXT,
            emergency   TEXT,
            category    TEXT,
            nav_alt_mcp REAL,
            nav_alt_fms REAL,
            nav_heading REAL,
            roll        REAL,
            rssi        REAL,
            messages    INTEGER,
            wind_speed  REAL,
            wind_dir    REAL,
            oat         REAL,
            tat         REAL
        );
        CREATE INDEX IF NOT EXISTS idx_hex_ts    ON positions (hex, ts);
        CREATE INDEX IF NOT EXISTS idx_ts        ON positions (ts);

        CREATE TABLE IF NOT EXISTS aircraft_info (
            hex              TEXT PRIMARY KEY,
            registration     TEXT,
            type             TEXT,
            icao_type        TEXT,
            manufacturer     TEXT,
            owner            TEXT,
            country          TEXT,
            url_photo        TEXT,
            url_photo_thumb  TEXT,
            fetched_at       INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS webhook_config (
            id                  INTEGER PRIMARY KEY DEFAULT 1,
            enabled             INTEGER NOT NULL DEFAULT 0,
            url                 TEXT NOT NULL DEFAULT '',
            cooldown_min        INTEGER NOT NULL DEFAULT 30,
            max_distance_km     REAL,
            trigger_new_session INTEGER NOT NULL DEFAULT 1,
            callsign_prefixes   TEXT NOT NULL DEFAULT '[]',
            include_callsign    INTEGER NOT NULL DEFAULT 1,
            include_hex         INTEGER NOT NULL DEFAULT 1,
            include_position    INTEGER NOT NULL DEFAULT 1,
            include_altitude    INTEGER NOT NULL DEFAULT 1,
            include_speed       INTEGER NOT NULL DEFAULT 1,
            include_track       INTEGER NOT NULL DEFAULT 0,
            include_squawk      INTEGER NOT NULL DEFAULT 0,
            include_photo       INTEGER NOT NULL DEFAULT 1,
            include_map_link    INTEGER NOT NULL DEFAULT 1,
            include_session_id  INTEGER NOT NULL DEFAULT 1,
            include_distance    INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS webhook_sent (
            hex        TEXT NOT NULL,
            session_id TEXT NOT NULL,
            sent_at    INTEGER NOT NULL,
            PRIMARY KEY (hex, session_id)
        );
    """)
    try:
        con.execute("ALTER TABLE positions ADD COLUMN session_id TEXT")
        con.commit()
    except Exception:
        pass  # colonna già esiste
    # Indice su session_id creato DOPO l'ALTER TABLE (evita "no such column" su DB vecchi)
    try:
        con.execute("CREATE INDEX IF NOT EXISTS idx_session ON positions (session_id)")
        con.commit()
    except Exception:
        pass
    # Inserisci config di default se non esiste
    con.execute("""
        INSERT OR IGNORE INTO webhook_config (id) VALUES (1)
    """)
    con.commit()
    con.close()

async def _migrate_session_ids_bg():
    CHUNK = 5000
    await asyncio.sleep(5)
    while True:
        con = get_db()
        rows = con.execute(
            "SELECT id, hex, ts FROM positions WHERE session_id IS NULL ORDER BY hex, ts LIMIT ?",
            (CHUNK,)
        ).fetchall()
        if not rows:
            con.close()
            break
        current_hex = None
        current_sid = None
        last_ts = None
        updates = []
        for row in rows:
            if row["hex"] != current_hex or (last_ts is not None and row["ts"] - last_ts > GAP_S):
                current_sid = make_session_id(row["hex"], row["ts"])
                current_hex = row["hex"]
            last_ts = row["ts"]
            updates.append((current_sid, row["id"]))
        con.executemany("UPDATE positions SET session_id = ? WHERE id = ?", updates)
        con.commit()
        con.close()
        await asyncio.sleep(0.1)

# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------

async def fire_webhook(hex_code, flight, session_id, aircraft, now_s, is_test=False):
    """Controlla le regole e spara il webhook se le condizioni sono soddisfatte."""
    con = get_db()
    cfg = con.execute("SELECT * FROM webhook_config WHERE id = 1").fetchone()
    if not cfg:
        con.close()
        return

    if not is_test:
        if not cfg["enabled"] or not cfg["url"]:
            print(f"[webhook] SKIP {flight}: not enabled or no url", flush=True)
            con.close()
            return

        # Filtro callsign
        prefixes = json.loads(cfg["callsign_prefixes"] or "[]")
        if prefixes:
            f = (flight or "").upper()
            if not any(f.startswith(p.upper()) for p in prefixes):
                print(f"[webhook] SKIP {flight}: non in prefixes {prefixes}", flush=True)
                con.close()
                return

        # Filtro geofence
        if cfg["max_distance_km"]:
            lat = aircraft.get("lat")
            lon = aircraft.get("lon")
            if lat is not None and lon is not None and RECEIVER_LAT and RECEIVER_LON:
                dist = haversine_km(RECEIVER_LAT, RECEIVER_LON, lat, lon)
                if dist > cfg["max_distance_km"]:
                    print(f"[webhook] SKIP {flight}: fuori geofence ({dist:.1f}km > {cfg['max_distance_km']}km)", flush=True)
                    con.close()
                    return

        # Cooldown per sessione (non per hex — ogni nuovo volo deve notificare)
        already = con.execute(
            "SELECT sent_at FROM webhook_sent WHERE session_id = ?",
            (session_id,)
        ).fetchone()
        if already:
            print(f"[webhook] SKIP {flight}: già notificato per sessione {session_id}", flush=True)
            con.close()
            return

    # Merge con ultima posizione DB: copre i campi mancanti quando il webhook
    # scatta su flight_just_appeared e l'aereo non ha ancora inviato tutto
    db_pos = con.execute(
        """SELECT lat, lon, alt_baro, gs, track, squawk
           FROM positions WHERE hex = ? ORDER BY ts DESC LIMIT 1""",
        (hex_code.lower(),)
    ).fetchone()
    if db_pos:
        merged = dict(db_pos)
        merged.update({k: v for k, v in aircraft.items() if v is not None})
        aircraft = merged

    # Build payload
    payload = {
        "evento": "aereo_speciale_rilevato",
        "timestamp": datetime.fromtimestamp(now_s, tz=timezone.utc).isoformat(),
    }

    if cfg["include_session_id"] or is_test:
        payload["session_id"] = session_id
    if cfg["include_callsign"] or is_test:
        payload["callsign"] = (flight or "").strip() or hex_code.upper()
    if cfg["include_hex"] or is_test:
        payload["hex"] = hex_code.upper()

    lat = aircraft.get("lat")
    lon = aircraft.get("lon")

    if (cfg["include_position"] or is_test) and lat is not None:
        payload["lat"] = lat
        payload["lon"] = lon

    if (cfg["include_distance"] or is_test) and lat is not None and RECEIVER_LAT and RECEIVER_LON:
        payload["distanza_km"] = round(haversine_km(RECEIVER_LAT, RECEIVER_LON, lat, lon), 1)

    alt = aircraft.get("alt_baro")
    if (cfg["include_altitude"] or is_test) and alt is not None and alt != "ground":
        payload["quota_ft"] = int(alt)
        payload["quota_m"] = int(alt * 0.3048)

    gs = aircraft.get("gs")
    if (cfg["include_speed"] or is_test) and gs is not None:
        payload["velocita_kt"] = round(gs)
        payload["velocita_kmh"] = round(gs * 1.852)

    if (cfg["include_track"] or is_test) and aircraft.get("track") is not None:
        payload["rotta"] = round(aircraft["track"])

    if (cfg["include_squawk"] or is_test) and aircraft.get("squawk"):
        payload["squawk"] = aircraft["squawk"]

    if (cfg["include_map_link"] or is_test) and SITE_URL and session_id:
        payload["mappa_url"] = f"{SITE_URL.rstrip('/')}/#s={session_id}"

    # Foto + dati aereo: cache → adsbdb → Planespotters (in cascade)
    if cfg["include_photo"] or is_test:
        photo_row = con.execute(
            "SELECT url_photo, url_photo_thumb, registration, type, owner FROM aircraft_info WHERE hex = ?",
            (hex_code.lower(),)
        ).fetchone()
        if photo_row and photo_row["url_photo"]:
            # già in cache con foto
            payload["foto_url"]       = photo_row["url_photo"]
            payload["foto_thumb_url"] = photo_row["url_photo_thumb"]
            if photo_row["registration"]: payload["registrazione"] = photo_row["registration"]
            if photo_row["type"]:         payload["tipo_aereo"]    = photo_row["type"]
            if photo_row["owner"]:        payload["operatore"]     = photo_row["owner"]
        else:
            # fetch adsbdb + planespotters in background (non blocca il webhook)
            asyncio.create_task(_fetch_and_cache_aircraft(hex_code.lower()))

    if not is_test:
        # Registra invio per cooldown
        con.execute(
            "INSERT OR REPLACE INTO webhook_sent (hex, session_id, sent_at) VALUES (?, ?, ?)",
            (hex_code, session_id, now_s)
        )
        con.commit()

    con.close()

    url = cfg["url"] if not is_test else cfg["url"]
    if not url:
        return

    print(f"[webhook] FIRE {flight} (hex={hex_code}, session={session_id}) → {url}", flush=True)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=payload)
        print(f"[webhook] risposta HTTP {r.status_code}", flush=True)
    except Exception as e:
        print(f"[webhook] ERRORE invio: {e}", flush=True)

# ---------------------------------------------------------------------------
# Poller
# ---------------------------------------------------------------------------

_db = None
_current_session = {}
_last_ts = {}
_known_flight = {}  # hex -> ultimo flight_str non-None visto

async def _delayed_fire_webhook(hex_code, flight, session_id, now_s, delay=6):
    """Aspetta che ultrafeeder abbia inviato dati completi, poi spara il webhook."""
    await asyncio.sleep(delay)
    con = get_db()
    fresh = con.execute(
        """SELECT lat, lon, alt_baro, gs, track, squawk, baro_rate, category
           FROM positions WHERE hex = ? ORDER BY ts DESC LIMIT 1""",
        (hex_code.lower(),)
    ).fetchone()
    con.close()
    aircraft = dict(fresh) if fresh else {}
    log.info(f"[webhook-delay] dati freschi per {flight} ({hex_code}): alt={aircraft.get('alt_baro')!r} gs={aircraft.get('gs')!r} track={aircraft.get('track')!r}")
    await fire_webhook(hex_code, flight, session_id, aircraft, now_s)

async def poller():
    global _db
    _db = get_db()
    async with httpx.AsyncClient(timeout=5) as client:
        while True:
            try:
                r = await client.get(ULTRAFEEDER_URL)
                if r.status_code == 200:
                    data = r.json()
                    now_s = int(time.time())
                    aircraft = data.get("aircraft", [])

                    rows = []
                    new_sessions = []  # (hex, flight, session_id, aircraft_data) da notificare

                    for a in aircraft:
                        if a.get("lat") is None or a.get("lon") is None:
                            continue
                        flight_str = (a.get("flight") or "").strip() or None
                        hex_code = a.get("hex")

                        last = _last_ts.get(hex_code)
                        is_new_session = last is None or now_s - last > GAP_S
                        # Callsign appare per la prima volta su hex già tracciato
                        flight_just_appeared = (
                            flight_str and
                            not is_new_session and
                            _known_flight.get(hex_code) is None and
                            is_special(flight_str)
                        )
                        if flight_str:
                            _known_flight[hex_code] = flight_str
                        if is_new_session:
                            _known_flight[hex_code] = flight_str
                            new_sid = make_session_id(hex_code, now_s)
                            _current_session[hex_code] = new_sid
                            if is_special(flight_str):
                                print(f"[poller] SPECIALE rilevato: {flight_str} ({hex_code}), nuova sessione {new_sid}", flush=True)
                                log.info(f"[poller] SPECIALE: {flight_str} hex={hex_code} sess={new_sid}")
                                new_sessions.append((hex_code, flight_str, new_sid, a))
                        elif flight_just_appeared:
                            sid = _current_session.get(hex_code, make_session_id(hex_code, now_s))
                            print(f"[poller] SPECIALE callsign apparso: {flight_str} ({hex_code}), sessione {sid}", flush=True)
                            new_sessions.append((hex_code, flight_str, sid, a))
                        _last_ts[hex_code] = now_s
                        sid = _current_session[hex_code]

                        rows.append((
                            now_s, hex_code, flight_str,
                            1 if is_pegaso(flight_str) else 0,
                            sid,
                            a.get("lat"), a.get("lon"),
                            a.get("alt_baro") if a.get("alt_baro") != "ground" else 0,
                            a.get("alt_geom"), a.get("gs"), a.get("ias"), a.get("tas"),
                            a.get("mach"), a.get("track"), a.get("mag_heading"),
                            a.get("true_heading"), a.get("baro_rate"), a.get("geom_rate"),
                            a.get("squawk"),
                            a.get("emergency") if a.get("emergency") not in (None, "none") else None,
                            a.get("category"), a.get("nav_altitude_mcp"), a.get("nav_altitude_fms"),
                            a.get("nav_heading"), a.get("roll"), a.get("rssi"), a.get("messages"),
                            a.get("wind_speed"), a.get("wind_dir"), a.get("oat"), a.get("tat"),
                        ))

                    if rows:
                        _db.executemany("""
                            INSERT INTO positions (
                                ts, hex, flight, is_hems, session_id, lat, lon,
                                alt_baro, alt_geom, gs, ias, tas, mach,
                                track, mag_heading, true_heading,
                                baro_rate, geom_rate, squawk, emergency,
                                category, nav_alt_mcp, nav_alt_fms, nav_heading,
                                roll, rssi, messages, wind_speed, wind_dir, oat, tat
                            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        """, rows)

                    _db.execute("""
                        DELETE FROM positions
                        WHERE is_hems = 0
                          AND hex IN (
                              SELECT hex FROM positions
                              WHERE is_hems = 0
                              GROUP BY hex HAVING MAX(ts) < ?
                          )
                    """, (now_s - RETAIN_AIRCRAFT_S,))
                    _db.execute("""
                        DELETE FROM positions
                        WHERE is_hems = 0
                          AND ts < (SELECT MAX(ts) FROM positions p2 WHERE p2.hex = positions.hex) - ?
                    """, (RETAIN_S,))
                    _db.execute(
                        "DELETE FROM positions WHERE ts < ? AND is_hems = 1",
                        (now_s - RETAIN_HEMS_S,)
                    )
                    _db.execute(
                        "DELETE FROM webhook_sent WHERE sent_at < ?",
                        (now_s - 7 * 24 * 3600,)
                    )
                    _db.commit()

                    # Webhook per nuove sessioni speciali (fuori dal lock DB)
                    # Aspetta 6s per avere dati completi da ultrafeeder
                    for (hx, fl, sid, ac) in new_sessions:
                        asyncio.create_task(_delayed_fire_webhook(hx, fl, sid, now_s, delay=6))

            except Exception:
                pass

            await asyncio.sleep(POLL_S)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task_poll = asyncio.create_task(poller())
    task_mig  = asyncio.create_task(_migrate_session_ids_bg())
    yield
    task_poll.cancel()
    task_mig.cancel()
    for t in (task_poll, task_mig):
        with contextlib.suppress(asyncio.CancelledError):
            await t
    if _db:
        _db.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ---------------------------------------------------------------------------
# Endpoints — trail / history / sessions
# ---------------------------------------------------------------------------

@app.get("/api/trail/{hex_code}")
def trail(hex_code: str):
    log.info(f"[API] GET /api/trail/{hex_code}")
    con = get_db()
    # Prende gli ultimi 3000 punti per evitare crash con storici HEMS da 7gg
    rows = con.execute("""
        SELECT ts, lat, lon, track FROM (
            SELECT ts, lat, lon, track FROM positions
            WHERE hex = ? AND lat IS NOT NULL
            ORDER BY ts DESC LIMIT 3000
        ) ORDER BY ts ASC
    """, (hex_code.lower(),)).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.get("/api/history/{hex_code}")
def history(hex_code: str):
    log.info(f"[API] GET /api/history/{hex_code}")
    con = get_db()
    # Limite a 3000 punti più recenti per evitare crash con storici HEMS da 7gg
    rows = con.execute("""
        SELECT ts, flight, lat, lon, alt_baro, alt_geom, gs, ias, tas, mach,
               track, mag_heading, true_heading, baro_rate, geom_rate, squawk, emergency,
               category, nav_alt_mcp, nav_alt_fms, nav_heading, roll, rssi, messages,
               wind_speed, wind_dir, oat, tat
        FROM (
            SELECT * FROM positions WHERE hex = ? ORDER BY ts DESC LIMIT 3000
        ) ORDER BY ts ASC
    """, (hex_code.lower(),)).fetchall()
    con.close()
    result = [dict(r) for r in rows]
    log.info(f"[API] /api/history/{hex_code} → {len(result)} punti")
    if result:
        sample = result[0]
        log.debug(f"[API] primo punto: ts={sample.get('ts')} alt_baro={sample.get('alt_baro')!r} gs={sample.get('gs')!r}")
    return result

@app.get("/api/sessions/{hex_code}")
def sessions(hex_code: str):
    con = get_db()
    rows = con.execute("""
        SELECT session_id, MIN(ts) AS first_ts, MAX(ts) AS last_ts,
               COUNT(*) AS points, MAX(flight) AS flight, MAX(is_hems) AS is_hems
        FROM positions
        WHERE hex = ? AND session_id IS NOT NULL
        GROUP BY session_id ORDER BY first_ts DESC
    """, (hex_code.lower(),)).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.get("/api/session/{session_id}/trail")
def session_trail(session_id: str):
    con = get_db()
    rows = con.execute(
        "SELECT ts, lat, lon, track FROM positions WHERE session_id = ? AND lat IS NOT NULL ORDER BY ts ASC",
        (session_id,)
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.get("/api/session/{session_id}/history")
def session_history(session_id: str):
    log.info(f"[API] GET /api/session/{session_id}/history")
    con = get_db()
    rows = con.execute("""
        SELECT ts, flight, lat, lon, alt_baro, alt_geom, gs, ias, tas, mach,
               track, mag_heading, true_heading, baro_rate, geom_rate, squawk, emergency,
               category, nav_alt_mcp, nav_alt_fms, nav_heading, roll, rssi, messages,
               wind_speed, wind_dir, oat, tat
        FROM positions WHERE session_id = ? ORDER BY ts ASC
    """, (session_id,)).fetchall()
    con.close()
    result = [dict(r) for r in rows]
    log.info(f"[API] /api/session/{session_id}/history → {len(result)} punti")
    if result:
        sample = result[0]
        log.debug(f"[API] primo punto: ts={sample.get('ts')} alt_baro={sample.get('alt_baro')!r} gs={sample.get('gs')!r}")
    return result

@app.get("/api/session/{session_id}/info")
def session_info(session_id: str):
    con = get_db()
    row = con.execute("""
        SELECT hex, MAX(flight) AS flight,
               MIN(ts) AS first_ts, MAX(ts) AS last_ts,
               COUNT(*) AS points, MAX(is_hems) AS is_hems
        FROM positions WHERE session_id = ?
    """, (session_id,)).fetchone()
    con.close()
    if not row or not row["hex"]:
        raise HTTPException(status_code=404, detail="Session not found")
    return dict(row)

@app.get("/api/known")
def known():
    log.debug("[API] GET /api/known")
    """Restituisce l'ultima posizione nota per ogni aereo nel DB.
    Usa MAX(ts) aggregate di SQLite: quando presente, gli altri campi
    non aggregati prendono il valore dalla riga con il ts massimo."""
    con = get_db()
    rows = con.execute("""
        SELECT p.hex,
               (SELECT flight FROM positions p2
                WHERE p2.hex = p.hex AND p2.flight IS NOT NULL
                ORDER BY p2.ts DESC LIMIT 1)  AS flight,
               p.lat          AS last_lat,
               p.lon          AS last_lon,
               p.alt_baro     AS last_alt_baro,
               p.gs           AS last_gs,
               p.track        AS last_track,
               p.squawk       AS last_squawk,
               p.category     AS last_category,
               MAX(p.ts)      AS last_seen,
               p.session_id   AS last_session_id,
               COUNT(*)       AS points
        FROM positions p
        GROUP BY p.hex
        ORDER BY last_seen DESC
    """).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.get("/api/stats")
def stats():
    con = get_db()
    row = con.execute("""
        SELECT COUNT(*) as rows, MIN(ts) as oldest, MAX(ts) as newest, COUNT(DISTINCT hex) as aircraft
        FROM positions
    """).fetchone()
    con.close()
    now = int(time.time())
    return {
        "rows": row["rows"], "aircraft": row["aircraft"],
        "oldest_s": now - row["oldest"] if row["oldest"] else None,
        "newest_s": now - row["newest"] if row["newest"] else None,
    }

async def _fetch_and_cache_aircraft(hex_code: str) -> dict:
    """Fetcha info aereo da adsbdb, poi foto da Planespotters se assente.
    Salva in cache e restituisce il dict."""
    now_s = int(time.time())
    info = {"hex": hex_code, "fetched_at": now_s}

    # 1. adsbdb — dati completi (registrazione, tipo, operatore, foto)
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(f"https://api.adsbdb.com/v0/aircraft/{hex_code}",
                                 headers={"User-Agent": "HydraPlanes/1.0"})
        if r.status_code == 200:
            data = r.json().get("response", {}).get("aircraft") or {}
            info.update({
                "registration": data.get("registration"),
                "type":         data.get("type"),
                "icao_type":    data.get("icao_type"),
                "manufacturer": data.get("manufacturer"),
                "owner":        data.get("registered_owner"),
                "country":      data.get("registered_owner_country_name"),
                "url_photo":    data.get("url_photo"),
                "url_photo_thumb": data.get("url_photo_thumbnail"),
            })
    except Exception:
        pass

    # 2. Planespotters — fallback foto se adsbdb non ce l'ha
    if not info.get("url_photo"):
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.get(
                    f"https://api.planespotters.net/pub/photos/hex/{hex_code}",
                    headers={"User-Agent": "HydraPlanes/1.0"}
                )
            if r.status_code == 200:
                photos = r.json().get("photos", [])
                if photos:
                    p = photos[0]
                    info["url_photo"]       = p.get("thumbnail_large", {}).get("src")
                    info["url_photo_thumb"] = p.get("thumbnail", {}).get("src")
                    # Prendi registrazione/tipo se non già in info
                    ac = p.get("aircraft", {})
                    if not info.get("registration"):
                        info["registration"] = ac.get("reg") or ac.get("registration")
                    if not info.get("type"):
                        info["type"] = ac.get("type")
        except Exception:
            pass

    con = get_db()
    con.execute("""
        INSERT OR REPLACE INTO aircraft_info
        (hex, registration, type, icao_type, manufacturer, owner, country,
         url_photo, url_photo_thumb, fetched_at)
        VALUES (:hex, :registration, :type, :icao_type, :manufacturer, :owner,
                :country, :url_photo, :url_photo_thumb, :fetched_at)
    """, {k: info.get(k) for k in
          ("hex","registration","type","icao_type","manufacturer","owner",
           "country","url_photo","url_photo_thumb","fetched_at")})
    con.commit()
    con.close()
    return info


@app.get("/api/aircraft/{hex_code}")
async def aircraft_info(hex_code: str):
    hex_code = hex_code.lower()
    cache_ttl = 30 * 24 * 3600
    now_s = int(time.time())
    con = get_db()
    row = con.execute(
        "SELECT * FROM aircraft_info WHERE hex = ? AND fetched_at > ?",
        (hex_code, now_s - cache_ttl)
    ).fetchone()
    con.close()
    if row and row["url_photo"]:
        return dict(row)
    # Non in cache o senza foto → fetch completo
    return await _fetch_and_cache_aircraft(hex_code)

# ---------------------------------------------------------------------------
# Endpoints — webhook config
# ---------------------------------------------------------------------------

@app.get("/api/webhook/config")
def get_webhook_config():
    con = get_db()
    row = con.execute("SELECT * FROM webhook_config WHERE id = 1").fetchone()
    con.close()
    if not row:
        return DEFAULT_WEBHOOK_CONFIG
    d = dict(row)
    d["callsign_prefixes"] = json.loads(d.get("callsign_prefixes") or "[]")
    return d

class WebhookConfigIn(BaseModel):
    enabled: bool = False
    url: str = ""
    cooldown_min: int = 30
    max_distance_km: float | None = None
    trigger_new_session: bool = True
    callsign_prefixes: list[str] = []
    include_callsign: bool = True
    include_hex: bool = True
    include_position: bool = True
    include_altitude: bool = True
    include_speed: bool = True
    include_track: bool = False
    include_squawk: bool = False
    include_photo: bool = True
    include_map_link: bool = True
    include_session_id: bool = True
    include_distance: bool = True

@app.put("/api/webhook/config")
def save_webhook_config(cfg: WebhookConfigIn):
    con = get_db()
    con.execute("""
        INSERT OR REPLACE INTO webhook_config (
            id, enabled, url, cooldown_min, max_distance_km, trigger_new_session,
            callsign_prefixes,
            include_callsign, include_hex, include_position, include_altitude, include_speed,
            include_track, include_squawk, include_photo, include_map_link,
            include_session_id, include_distance
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        int(cfg.enabled), cfg.url, cfg.cooldown_min, cfg.max_distance_km,
        int(cfg.trigger_new_session), json.dumps(cfg.callsign_prefixes),
        int(cfg.include_callsign), int(cfg.include_hex), int(cfg.include_position),
        int(cfg.include_altitude), int(cfg.include_speed), int(cfg.include_track),
        int(cfg.include_squawk), int(cfg.include_photo), int(cfg.include_map_link),
        int(cfg.include_session_id), int(cfg.include_distance),
    ))
    con.commit()
    con.close()
    return {"ok": True}

@app.post("/api/webhook/test")
async def test_webhook():
    """Manda il payload dell'ultimo PEGASO reale trovato nel DB.
    Se non c'è nessun PEGASO usa dati sintetici."""
    con = get_db()
    cfg = con.execute("SELECT * FROM webhook_config WHERE id = 1").fetchone()
    if not cfg or not cfg["url"]:
        con.close()
        raise HTTPException(status_code=400, detail="Nessun URL webhook configurato")

    # Cerca l'ultima posizione di qualsiasi aereo PEGASO/PGSO nel DB
    row = con.execute("""
        SELECT hex, flight, lat, lon, alt_baro, gs, track, squawk, session_id, ts
        FROM positions
        WHERE (flight LIKE 'PEGASO%' OR flight LIKE 'PGSO%')
          AND lat IS NOT NULL
        ORDER BY ts DESC
        LIMIT 1
    """).fetchone()
    con.close()

    now_s = int(time.time())

    if row:
        hex_code   = row["hex"]
        flight     = row["flight"] or "PEGASO"
        session_id = row["session_id"] or "test000"
        aircraft   = {
            "lat":      row["lat"],
            "lon":      row["lon"],
            "alt_baro": row["alt_baro"],
            "gs":       row["gs"],
            "track":    row["track"],
            "squawk":   row["squawk"],
        }
        # Assicura che la foto sia in cache (adsbdb → planespotters)
        await _fetch_and_cache_aircraft(hex_code.lower())
    else:
        # Nessun PEGASO nel DB: usa dati sintetici
        hex_code   = "abc123"
        flight     = "PEGASO51"
        session_id = "test000"
        aircraft   = {
            "lat": RECEIVER_LAT + 0.05 if RECEIVER_LAT else 45.0,
            "lon": RECEIVER_LON + 0.05 if RECEIVER_LON else 9.0,
            "alt_baro": 2500,
            "gs": 120,
            "track": 270,
            "squawk": "7000",
        }

    try:
        await fire_webhook(hex_code, flight, session_id, aircraft, now_s, is_test=True)
        source = f"dati reali ({flight})" if row else "dati sintetici (nessun PEGASO nel DB)"
        return {"ok": True, "message": f"Payload inviato — {source}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"ok": True}
