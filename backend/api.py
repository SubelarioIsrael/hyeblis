# api.py – Flask REST API for HYEBLiS monitor

from __future__ import annotations

import logging

from flask import Flask, jsonify, request
from flask_cors import CORS

import database

logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # allow the Vite dev server (or any origin) to reach the API


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


# ── Error handlers ────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(exc):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def internal_error(exc):
    logger.exception("Unhandled exception in API: %s", exc)
    return jsonify({"error": "Internal server error"}), 500
