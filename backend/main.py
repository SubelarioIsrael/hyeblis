# main.py – Entry point for HYEBLiS monitor
#
# Starts two concurrent activities:
#   1. Data-collection loop  – reads the sensor and writes to SQLite.
#   2. Flask API server      – serves /latest and /history to the frontend.
#
# Designed to run under systemd (see hyeblis-monitor.service).

from __future__ import annotations

import logging
import logging.handlers
import os
import signal
import sys
import threading
import time

import config
import database
from api import app
from sensor import create_sensor

# ── Logging setup ─────────────────────────────────────────────────────────────

def _setup_logging() -> None:
    os.makedirs(os.path.dirname(config.LOG_FILE), exist_ok=True)

    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]

    try:
        handlers.append(
            logging.handlers.RotatingFileHandler(
                config.LOG_FILE,
                maxBytes=5 * 1024 * 1024,  # 5 MB
                backupCount=3,
            )
        )
    except OSError as exc:
        print(f"WARNING: cannot open log file {config.LOG_FILE!r}: {exc}", file=sys.stderr)

    logging.basicConfig(
        level=getattr(logging, config.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        handlers=handlers,
    )


logger = logging.getLogger(__name__)

# ── Globals ───────────────────────────────────────────────────────────────────

_shutdown = threading.Event()


def _handle_signal(signum: int, _frame) -> None:  # noqa: ANN001
    logger.info("Received signal %d – shutting down", signum)
    _shutdown.set()


# ── Data collection loop ──────────────────────────────────────────────────────

def _collection_loop() -> None:
    sensor = create_sensor()
    consecutive_errors = 0
    max_consecutive_errors = 10

    logger.info(
        "Data collection started (interval=%.1f s)", config.POLL_INTERVAL_SECONDS
    )

    while not _shutdown.is_set():
        try:
            reading = sensor.read()
            database.insert_reading(reading)
            consecutive_errors = 0
            logger.debug(
                "Recorded: %.3f V  %.4f A  %.4f W  %.1f %%",
                reading.voltage,
                reading.current,
                reading.power,
                reading.battery_percent,
            )
        except Exception as exc:
            consecutive_errors += 1
            logger.warning(
                "Sensor read error #%d: %s", consecutive_errors, exc
            )
            if consecutive_errors >= max_consecutive_errors:
                logger.error(
                    "Too many consecutive errors (%d) – re-initialising sensor",
                    consecutive_errors,
                )
                try:
                    sensor = create_sensor()
                    consecutive_errors = 0
                except Exception as reinit_exc:
                    logger.critical("Sensor re-init failed: %s", reinit_exc)

        _shutdown.wait(timeout=config.POLL_INTERVAL_SECONDS)

    logger.info("Data collection loop exited")


# ── Flask server (background thread) ─────────────────────────────────────────

def _start_api_server() -> None:
    logger.info("Starting API on %s:%d", config.API_HOST, config.API_PORT)
    # use_reloader=False is critical – reloader forks the process and breaks
    # the single-process design required for a systemd unit.
    app.run(
        host=config.API_HOST,
        port=config.API_PORT,
        debug=False,
        use_reloader=False,
        threaded=True,
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    _setup_logging()

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    logger.info("HYEBLiS monitor starting")
    database.init_db()

    # Flask runs in a daemon thread so it exits automatically when the main
    # thread sets _shutdown and the collection loop returns.
    api_thread = threading.Thread(target=_start_api_server, name="api", daemon=True)
    api_thread.start()

    _collection_loop()

    logger.info("HYEBLiS monitor stopped")


if __name__ == "__main__":
    main()
