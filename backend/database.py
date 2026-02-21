# database.py – SQLite persistence layer for HYEBLiS monitor

from __future__ import annotations

import logging
import os
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Generator

import config
from sensor import SensorReading

logger = logging.getLogger(__name__)

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS readings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       DATETIME NOT NULL,
    voltage         REAL     NOT NULL,
    current         REAL     NOT NULL,
    power           REAL     NOT NULL,
    battery_percent REAL     NOT NULL
);
"""

_CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings (timestamp DESC);
"""


# ── Connection helper ─────────────────────────────────────────────────────────

@contextmanager
def _get_conn() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(config.DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Public API ────────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create schema if it doesn't exist.  Idempotent."""
    os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
    with _get_conn() as conn:
        conn.execute(_CREATE_TABLE_SQL)
        conn.execute(_CREATE_INDEX_SQL)
    logger.info("Database ready at %s", config.DB_PATH)


def insert_reading(reading: SensorReading) -> None:
    """Persist a single sensor reading with a UTC timestamp."""
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO readings (timestamp, voltage, current, power, battery_percent)
            VALUES (:timestamp, :voltage, :current, :power, :battery_percent)
            """,
            {
                "timestamp": ts,
                **asdict(reading),
            },
        )


def fetch_latest() -> dict | None:
    """Return the most recent reading as a dict, or None if the table is empty."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM readings ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return dict(row) if row else None


def fetch_history(limit: int = 100) -> list[dict]:
    """Return the *limit* most-recent readings in ascending time order."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM (
                SELECT * FROM readings ORDER BY id DESC LIMIT ?
            ) ORDER BY id ASC
            """,
            (min(max(limit, 1), 10_000),),
        ).fetchall()
    return [dict(r) for r in rows]
