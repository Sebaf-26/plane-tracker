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
POLL_S = 2

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
                        rows.append((
                            now_s,
                            a.get("hex"),
                            (a.get("flight") or "").strip() or None,
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
                                ts, hex, flight, lat, lon,
                                alt_baro, alt_geom, gs, ias, tas, mach,
                                track, mag_heading, true_heading,
                                baro_rate, geom_rate, squawk, emergency,
                                category, nav_alt_mcp, nav_alt_fms, nav_heading,
                                roll, rssi, messages,
                                wind_speed, wind_dir, oat, tat
                            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        """, rows)

                    # Prune older than RETAIN_S
                    _db.execute("DELETE FROM positions WHERE ts < ?", (now_s - RETAIN_S,))
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
    """Lista hex degli aerei con storico nel DB."""
    con = get_db()
    rows = con.execute("""
        SELECT DISTINCT hex, MAX(flight) as flight, COUNT(*) as points
        FROM positions GROUP BY hex ORDER BY points DESC
    """).fetchall()
    con.close()
    return [dict(r) for r in rows]


@app.get("/health")
def health():
    return {"ok": True}
