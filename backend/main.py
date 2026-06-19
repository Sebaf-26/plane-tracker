import asyncio
import hashlib
import sqlite3
import time
import os
import contextlib

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

ULTRAFEEDER_URL = os.getenv("ULTRAFEEDER_URL", "http://ultrafeeder/data/aircraft.json")
DB_PATH = os.getenv("DB_PATH", "/data/hydra.db")
RETAIN_S = int(os.getenv("RETAIN_MINUTES", "10")) * 60
RETAIN_HEMS_S = 7 * 24 * 3600
RETAIN_AIRCRAFT_S = int(os.getenv("RETAIN_AIRCRAFT_HOURS", "24")) * 3600
POLL_S = 2
GAP_S = 600  # gap > 10min = nuova sessione

SPECIAL_PREFIXES = [
    "PEGASO", "PGSO", "PELIKA", "PELIC", "INSUB", "GRIFO", "NIKO", "HEMS",
    "VOLPE", "VOLP", "POLI", "FIAMMA", "FIAA", "CC",
    "DRAGO", "DRG", "VF", "VVF",
    "KOALA", "KLA", "CP", "GABBIA", "GABBN",
    "ICARO", "RESCUE", "AMI",
    "MARINA", "MM",
    "PONY",
]

def is_special(flight: str | None) -> bool:
    if not flight:
        return False
    f = flight.upper().strip()
    return any(f.startswith(p) for p in SPECIAL_PREFIXES)

def is_pegaso(flight: str | None) -> bool:
    if not flight:
        return False
    f = flight.upper().strip()
    return f.startswith("PEGASO") or f.startswith("PGSO")

def make_session_id(hex_code: str, ts: int) -> str:
    """Genera un ID sessione di 7 caratteri tipo 'a3k7m2p'."""
    raw = f"{hex_code}:{ts}"
    h = int(hashlib.md5(raw.encode()).hexdigest()[:8], 16)
    chars = '0123456789abcdefghjkmnpqrstvwxyz'
    result = ''
    for _ in range(7):
        result = chars[h % 32] + result
        h //= 32
    return result

# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = get_db()
    # WAL mode: permette letture concorrenti durante le scritture
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
        CREATE INDEX IF NOT EXISTS idx_session   ON positions (session_id);
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
    """)
    # Aggiungi colonna session_id se non esiste
    try:
        con.execute("ALTER TABLE positions ADD COLUMN session_id TEXT")
        con.commit()
    except Exception:
        pass  # colonna già esiste
    con.close()

async def _migrate_session_ids_bg():
    """Assegna session_id alle posizioni storiche in background (a chunk)
    per non bloccare il DB al startup."""
    CHUNK = 5000
    await asyncio.sleep(5)  # lascia partire il poller prima
    while True:
        con = get_db()
        rows = con.execute(
            "SELECT id, hex, ts FROM positions WHERE session_id IS NULL ORDER BY hex, ts LIMIT ?",
            (CHUNK,)
        ).fetchall()

        if not rows:
            con.close()
            break  # migrazione completata

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
        await asyncio.sleep(0.1)  # respira tra un chunk e l'altro

# ---------------------------------------------------------------------------
# Poller — traccia sessione corrente per ogni aereo
# ---------------------------------------------------------------------------

_db: sqlite3.Connection | None = None
_current_session: dict[str, str] = {}   # hex -> session_id corrente
_last_ts: dict[str, int] = {}           # hex -> ultimo timestamp

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
                    for a in aircraft:
                        if a.get("lat") is None or a.get("lon") is None:
                            continue
                        flight_str = (a.get("flight") or "").strip() or None
                        hex_code = a.get("hex")

                        # Nuova sessione se gap > GAP_S o prima volta
                        last = _last_ts.get(hex_code)
                        if last is None or now_s - last > GAP_S:
                            _current_session[hex_code] = make_session_id(hex_code, now_s)
                        _last_ts[hex_code] = now_s
                        sid = _current_session[hex_code]

                        rows.append((
                            now_s,
                            hex_code,
                            flight_str,
                            1 if is_pegaso(flight_str) else 0,
                            sid,
                            a.get("lat"),
                            a.get("lon"),
                            a.get("alt_baro") if a.get("alt_baro") != "ground" else 0,
                            a.get("alt_geom"),
                            a.get("gs"),
                            a.get("ias"),
                            a.get("tas"),
                            a.get("mach"),
                            a.get("track"),
                            a.get("mag_heading"),
                            a.get("true_heading"),
                            a.get("baro_rate"),
                            a.get("geom_rate"),
                            a.get("squawk"),
                            a.get("emergency") if a.get("emergency") not in (None, "none") else None,
                            a.get("category"),
                            a.get("nav_altitude_mcp"),
                            a.get("nav_altitude_fms"),
                            a.get("nav_heading"),
                            a.get("roll"),
                            a.get("rssi"),
                            a.get("messages"),
                            a.get("wind_speed"),
                            a.get("wind_dir"),
                            a.get("oat"),
                            a.get("tat"),
                        ))

                    if rows:
                        _db.executemany("""
                            INSERT INTO positions (
                                ts, hex, flight, is_hems, session_id, lat, lon,
                                alt_baro, alt_geom, gs, ias, tas, mach,
                                track, mag_heading, true_heading,
                                baro_rate, geom_rate, squawk, emergency,
                                category, nav_alt_mcp, nav_alt_fms, nav_heading,
                                roll, rssi, messages,
                                wind_speed, wind_dir, oat, tat
                            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        """, rows)

                    _db.execute("""
                        DELETE FROM positions
                        WHERE is_hems = 0
                          AND hex IN (
                              SELECT hex FROM positions
                              WHERE is_hems = 0
                              GROUP BY hex
                              HAVING MAX(ts) < ?
                          )
                    """, (now_s - RETAIN_AIRCRAFT_S,))
                    _db.execute("""
                        DELETE FROM positions
                        WHERE is_hems = 0
                          AND ts < (
                              SELECT MAX(ts) FROM positions p2
                              WHERE p2.hex = positions.hex
                          ) - ?
                    """, (RETAIN_S,))
                    _db.execute("""
                        DELETE FROM positions
                        WHERE ts < ? AND is_hems = 1
                    """, (now_s - RETAIN_HEMS_S,))
                    _db.commit()

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


@app.get("/api/trail/{hex_code}")
def trail(hex_code: str):
    con = get_db()
    rows = con.execute("""
        SELECT ts, lat, lon, track
        FROM positions
        WHERE hex = ? AND lat IS NOT NULL
        ORDER BY ts ASC
    """, (hex_code.lower(),)).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.get("/api/history/{hex_code}")
def history(hex_code: str):
    con = get_db()
    rows = con.execute("""
        SELECT ts, flight, lat, lon,
               alt_baro, alt_geom, gs, ias, tas, mach,
               track, mag_heading, true_heading,
               baro_rate, geom_rate, squawk, emergency,
               category, nav_alt_mcp, nav_alt_fms, nav_heading,
               roll, rssi, messages, wind_speed, wind_dir, oat, tat
        FROM positions
        WHERE hex = ?
        ORDER BY ts ASC
    """, (hex_code.lower(),)).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.get("/api/sessions/{hex_code}")
def sessions(hex_code: str):
    """Elenco sessioni per un aereo, dalla più recente."""
    con = get_db()
    rows = con.execute("""
        SELECT session_id,
               MIN(ts) AS first_ts,
               MAX(ts) AS last_ts,
               COUNT(*) AS points,
               MAX(flight) AS flight,
               MAX(is_hems) AS is_hems
        FROM positions
        WHERE hex = ? AND session_id IS NOT NULL
        GROUP BY session_id
        ORDER BY first_ts DESC
    """, (hex_code.lower(),)).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.get("/api/session/{session_id}/trail")
def session_trail(session_id: str):
    con = get_db()
    rows = con.execute("""
        SELECT ts, lat, lon, track
        FROM positions
        WHERE session_id = ? AND lat IS NOT NULL
        ORDER BY ts ASC
    """, (session_id,)).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.get("/api/session/{session_id}/history")
def session_history(session_id: str):
    con = get_db()
    rows = con.execute("""
        SELECT ts, flight, lat, lon,
               alt_baro, alt_geom, gs, ias, tas, mach,
               track, mag_heading, true_heading,
               baro_rate, geom_rate, squawk, emergency,
               category, nav_alt_mcp, nav_alt_fms, nav_heading,
               roll, rssi, messages, wind_speed, wind_dir, oat, tat
        FROM positions
        WHERE session_id = ?
        ORDER BY ts ASC
    """, (session_id,)).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.get("/api/session/{session_id}/info")
def session_info(session_id: str):
    """Metadati di una sessione (hex, flight, first/last ts, punti)."""
    con = get_db()
    row = con.execute("""
        SELECT hex, MAX(flight) AS flight,
               MIN(ts) AS first_ts, MAX(ts) AS last_ts,
               COUNT(*) AS points,
               MAX(lat) AS last_lat, MAX(lon) AS last_lon,
               MAX(is_hems) AS is_hems
        FROM positions
        WHERE session_id = ?
    """, (session_id,)).fetchone()
    con.close()
    if not row or not row["hex"]:
        raise HTTPException(status_code=404, detail="Session not found")
    return dict(row)


@app.get("/api/known")
def known():
    con = get_db()
    rows = con.execute("""
        SELECT p.hex,
               p.flight,
               p.lat        AS last_lat,
               p.lon        AS last_lon,
               p.alt_baro   AS last_alt_baro,
               p.gs         AS last_gs,
               p.track      AS last_track,
               p.squawk     AS last_squawk,
               p.category   AS last_category,
               p.ts         AS last_seen,
               p.session_id AS last_session_id,
               COUNT(*)     AS points
        FROM positions p
        INNER JOIN (
            SELECT hex, MAX(ts) AS max_ts FROM positions GROUP BY hex
        ) latest ON p.hex = latest.hex AND p.ts = latest.max_ts
        GROUP BY p.hex
        ORDER BY p.ts DESC
    """).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.get("/api/stats")
def stats():
    con = get_db()
    row = con.execute("""
        SELECT COUNT(*) as rows,
               MIN(ts) as oldest,
               MAX(ts) as newest,
               COUNT(DISTINCT hex) as aircraft
        FROM positions
    """).fetchone()
    con.close()
    now = int(time.time())
    return {
        "rows": row["rows"],
        "aircraft": row["aircraft"],
        "oldest_s": now - row["oldest"] if row["oldest"] else None,
        "newest_s": now - row["newest"] if row["newest"] else None,
    }

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
    if row:
        con.close()
        return dict(row)

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(f"https://api.adsbdb.com/v0/aircraft/{hex_code}",
                                 headers={"User-Agent": "HydraPlanes/1.0"})
        if r.status_code == 200:
            data = r.json().get("response", {}).get("aircraft") or {}
            info = {
                "hex": hex_code,
                "registration": data.get("registration"),
                "type": data.get("type"),
                "icao_type": data.get("icao_type"),
                "manufacturer": data.get("manufacturer"),
                "owner": data.get("registered_owner"),
                "country": data.get("registered_owner_country_name"),
                "url_photo": data.get("url_photo"),
                "url_photo_thumb": data.get("url_photo_thumbnail"),
                "fetched_at": now_s,
            }
        else:
            info = {"hex": hex_code, "fetched_at": now_s}
    except Exception:
        info = {"hex": hex_code, "fetched_at": now_s}

    con.execute("""
        INSERT OR REPLACE INTO aircraft_info
        (hex, registration, type, icao_type, manufacturer, owner, country, url_photo, url_photo_thumb, fetched_at)
        VALUES (:hex, :registration, :type, :icao_type, :manufacturer, :owner, :country, :url_photo, :url_photo_thumb, :fetched_at)
    """, info)
    con.commit()
    con.close()
    return info


@app.get("/health")
def health():
    return {"ok": True}
