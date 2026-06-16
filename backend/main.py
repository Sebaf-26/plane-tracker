import asyncio
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
RETAIN_HEMS_S = 7 * 24 * 3600  # 1 settimana per PEGASO
# Dopo quanto tempo eliminiamo un aereo che non si vede più (default 24h)
RETAIN_AIRCRAFT_S = int(os.getenv("RETAIN_AIRCRAFT_HOURS", "24")) * 3600
POLL_S = 2

def is_pegaso(flight: str | None) -> bool:
    if not flight:
        return False
    f = flight.upper().strip()
    return f.startswith("PEGASO") or f.startswith("PGSO")

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
    con.executescript("""
        CREATE TABLE IF NOT EXISTS positions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ts          INTEGER NOT NULL,
            hex         TEXT NOT NULL,
            flight      TEXT,
            is_hems     INTEGER NOT NULL DEFAULT 0,
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
        CREATE INDEX IF NOT EXISTS idx_hex_ts ON positions (hex, ts);
        CREATE INDEX IF NOT EXISTS idx_ts     ON positions (ts);
    """)
    con.commit()
    con.close()

# ---------------------------------------------------------------------------
# Poller
# ---------------------------------------------------------------------------

_db: sqlite3.Connection | None = None

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
                    rows.append((
                            now_s,
                            a.get("hex"),
                            flight_str,
                            1 if is_pegaso(flight_str) else 0,
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
                                ts, hex, flight, is_hems, lat, lon,
                                alt_baro, alt_geom, gs, ias, tas, mach,
                                track, mag_heading, true_heading,
                                baro_rate, geom_rate, squawk, emergency,
                                category, nav_alt_mcp, nav_alt_fms, nav_heading,
                                roll, rssi, messages,
                                wind_speed, wind_dir, oat, tat
                            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        """, rows)

                    # Per ogni aereo non-HEMS: tieni solo gli ultimi RETAIN_S secondi
                    # del SUO ultimo avvistamento (non rispetto a "adesso").
                    # Così gli aerei scomparsi mantengono la loro traccia.
                    # Dopo RETAIN_AIRCRAFT_S dall'ultimo avvistamento, elimina tutto.
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
                    # HEMS: 1 settimana
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
    task = asyncio.create_task(poller())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
    if _db:
        _db.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/trail/{hex_code}")
def trail(hex_code: str):
    """Ultime posizioni (lat/lon/ts) per disegnare la traccia."""
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
    """Tutti i campi per i grafici."""
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


@app.get("/api/known")
def known():
    """Lista aerei con storico nel DB, con ultima posizione nota."""
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

@app.get("/health")
def health():
    return {"ok": True}
