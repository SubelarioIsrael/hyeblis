# api.py – Flask REST API for HYEBLiS monitor

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS

import database

logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # allow the Vite dev server (or any origin) to reach the API


def _normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.replace("\ufeff", "").strip().lower())


def _parse_float(value: str) -> float:
    text = str(value).strip()
    if not text:
        raise ValueError("empty numeric value")
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    else:
        text = text.replace(",", "")
    return float(text)


def _parse_datetime_value(value: str) -> datetime:
    text = value.strip()
    if not text:
        raise ValueError("empty timestamp")

    if "T" in text:
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            pass

    formats = [
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y %I:%M:%S %p",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue

    raise ValueError(f"unsupported timestamp format: {text}")


def _extract_header_map(header_cells: list[str]) -> dict[str, int]:
    normalized = [_normalize_header(h) for h in header_cells]
    return {h: i for i, h in enumerate(normalized) if h}


def _get_index(mapping: dict[str, int], *candidates: str) -> int | None:
    for name in candidates:
        if name in mapping:
            return mapping[name]
    return None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/latest")
def latest():
    """Return the most recent sensor reading."""
    row = database.fetch_latest()
    if row is None:
        return jsonify({"error": "No readings available yet"}), 404
    return jsonify(row)


@app.get("/history")
def history():
    """Return the N most recent readings (ascending order).

    Query param  limit  – integer 1–10000, default 100.
    """
    try:
        limit = int(request.args.get("limit", 100))
    except (TypeError, ValueError):
        return jsonify({"error": "limit must be an integer"}), 400

    rows = database.fetch_history(limit)
    return jsonify(rows)


@app.get("/health")
def health():
    """Lightweight liveness probe."""
    return jsonify({"status": "ok"})


@app.delete("/history")
def clear_history():
    """Delete all readings from storage."""
    deleted = database.clear_all_readings()
    return jsonify({"deleted": deleted})


@app.post("/history/clear")
def clear_history_post():
    """Delete all readings from storage (POST fallback for restricted proxies)."""
    deleted = database.clear_all_readings()
    return jsonify({"deleted": deleted})


@app.post("/import")
def import_rows():
    """Import historical readings into SQLite.

    Request body:
      {
        "rows": [
          {
            "timestamp": "2026-04-22T00:00:00",
            "voltage": 13.9,
            "current": 1.5,
            "power": 22.1,
            "battery_percent": 81.1
          }
        ]
      }
    """
    payload = request.get_json(silent=True) or {}
    rows = payload.get("rows")

    if not isinstance(rows, list):
        return jsonify({"error": "rows must be an array"}), 400

    if len(rows) == 0:
        return jsonify({"error": "rows must not be empty"}), 400

    if len(rows) > 50_000:
        return jsonify({"error": "rows exceeds max 50000"}), 400

    required = {"timestamp", "voltage", "current", "power", "battery_percent"}

    normalized: list[dict] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            return jsonify({"error": f"row {index} must be an object"}), 400

        missing = [key for key in required if key not in row]
        if missing:
            return jsonify({"error": f"row {index} missing fields: {', '.join(missing)}"}), 400

        try:
            normalized.append(
                {
                    "timestamp": str(row["timestamp"]),
                    "voltage": float(row["voltage"]),
                    "current": float(row["current"]),
                    "power": float(row["power"]),
                    "battery_percent": float(row["battery_percent"]),
                }
            )
        except (TypeError, ValueError):
            return jsonify({"error": f"row {index} contains invalid numeric values"}), 400

    inserted = database.insert_imported_readings(normalized)
    return jsonify({"inserted": inserted})


@app.post("/import-file")
def import_file():
    """Import readings from an uploaded CSV file (multipart/form-data)."""
    upload = request.files.get("file")
    if upload is None:
        return jsonify({"error": "file is required"}), 400

    raw = upload.read()
    if not raw:
        return jsonify({"error": "uploaded file is empty"}), 400

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252", errors="replace")

    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ","

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = [row for row in reader if any(cell.strip() for cell in row)]
    if len(rows) < 2:
        return jsonify({"error": "CSV must contain a header and at least one data row"}), 400

    header_idx = -1
    header_map: dict[str, int] = {}
    header_scan_limit = min(30, len(rows))
    for idx in range(header_scan_limit):
        mapping = _extract_header_map(rows[idx])

        voltage_idx = _get_index(mapping, "voltage", "voltagev")
        current_idx = _get_index(mapping, "current", "currenta")
        power_idx = _get_index(mapping, "power", "powerw", "powerin", "powerinw")
        battery_idx = _get_index(mapping, "battery", "batterypercent", "batterypct", "batterylevel")
        timestamp_idx = _get_index(mapping, "timestamp", "datetime")
        date_idx = _get_index(mapping, "date")
        time_idx = _get_index(mapping, "time")

        has_core = (
            voltage_idx is not None
            and current_idx is not None
            and power_idx is not None
            and battery_idx is not None
        )
        has_time = timestamp_idx is not None or (date_idx is not None and time_idx is not None)

        if has_core and has_time:
            header_idx = idx
            header_map = mapping
            break

    if header_idx == -1:
        return jsonify(
            {
                "error": "Could not detect CSV header. Expected Date+Time (or Timestamp) and Voltage, Current, Power, Battery columns."
            }
        ), 400

    voltage_idx = _get_index(header_map, "voltage", "voltagev")
    current_idx = _get_index(header_map, "current", "currenta")
    power_idx = _get_index(header_map, "power", "powerw", "powerin", "powerinw")
    battery_idx = _get_index(header_map, "battery", "batterypercent", "batterypct", "batterylevel")
    timestamp_idx = _get_index(header_map, "timestamp", "datetime")
    date_idx = _get_index(header_map, "date")
    time_idx = _get_index(header_map, "time")

    parsed: list[dict] = []
    skipped = 0

    for row in rows[header_idx + 1 :]:
        try:
            if timestamp_idx is not None:
                raw_ts = row[timestamp_idx]
            else:
                raw_ts = f"{row[date_idx or 0]} {row[time_idx or 0]}"

            timestamp = _parse_datetime_value(raw_ts).isoformat(timespec="seconds")

            parsed.append(
                {
                    "timestamp": timestamp,
                    "voltage": _parse_float(row[voltage_idx or 0]),
                    "current": _parse_float(row[current_idx or 0]),
                    "power": _parse_float(row[power_idx or 0]),
                    "battery_percent": _parse_float(row[battery_idx or 0]),
                }
            )
        except (IndexError, ValueError, TypeError):
            skipped += 1

    if not parsed:
        return jsonify({"error": "No valid data rows were found in the uploaded CSV"}), 400

    inserted = database.insert_imported_readings(parsed)
    return jsonify({"inserted": inserted, "skipped": skipped})


# ── Error handlers ────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(exc):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def internal_error(exc):
    logger.exception("Unhandled exception in API: %s", exc)
    return jsonify({"error": "Internal server error"}), 500
