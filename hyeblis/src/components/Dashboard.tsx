// src/components/Dashboard.tsx – App shell with sidebar + page routing

import React, { useCallback, useMemo, useRef, useState } from "react";
import DataLog from "./DataLog";
import MetricCard from "./MetricCard";
import PowerChart from "./PowerChart";
import Sidebar, { type Page } from "./Sidebar";
import StatusBar from "./StatusBar";
import { useHistoryData } from "../hooks/useHistoryData";
import { usePowerData } from "../hooks/usePowerData";
import type { PowerReading } from "../types";

const API_BASE: string =
  import.meta.env.VITE_API_BASE_URL ??
  ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000"
    : "");

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current.trim());
  return out;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\ufeff/, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;

  const normalized =
    trimmed.includes(",") && !trimmed.includes(".")
      ? trimmed.replace(/,/g, ".")
      : trimmed.replace(/,/g, "");

  return Number.parseFloat(normalized);
}

function getColumnIndexes(headers: string[]): {
  voltageIdx?: number;
  currentIdx?: number;
  powerIdx?: number;
  batteryIdx?: number;
  timestampIdx?: number;
  dateIdx?: number;
  timeIdx?: number;
} {
  const indexMap = new Map<string, number>();
  headers.forEach((h, idx) => indexMap.set(h, idx));

  return {
    voltageIdx: indexMap.get("voltage") ?? indexMap.get("voltagev"),
    currentIdx: indexMap.get("current") ?? indexMap.get("currenta"),
    powerIdx:
      indexMap.get("power") ??
      indexMap.get("powerw") ??
      indexMap.get("powerin") ??
      indexMap.get("powerinw"),
    batteryIdx:
      indexMap.get("battery") ??
      indexMap.get("batterypercent") ??
      indexMap.get("batterypct") ??
      indexMap.get("batterylevel"),
    timestampIdx: indexMap.get("timestamp") ?? indexMap.get("datetime"),
    dateIdx: indexMap.get("date"),
    timeIdx: indexMap.get("time"),
  };
}

function parseCsvRows(content: string): Array<Omit<PowerReading, "id">> {
  const lines = content
    .replace(/^\ufeff/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("CSV appears to be empty.");
  }

  const delimiters = [",", ";", "\t", "|"];

  let headerLineIndex = -1;
  let delimiter = ",";
  let columnIndexes: ReturnType<typeof getColumnIndexes> = {};

  const headerScanCount = Math.min(lines.length, 20);
  for (let i = 0; i < headerScanCount; i += 1) {
    for (const candidateDelimiter of delimiters) {
      const normalizedHeaders = parseCsvLine(lines[i], candidateDelimiter).map(normalizeHeader);
      const indexes = getColumnIndexes(normalizedHeaders);

      const hasCoreColumns =
        indexes.voltageIdx !== undefined &&
        indexes.currentIdx !== undefined &&
        indexes.powerIdx !== undefined &&
        indexes.batteryIdx !== undefined;
      const hasTimeColumns =
        indexes.timestampIdx !== undefined ||
        (indexes.dateIdx !== undefined && indexes.timeIdx !== undefined);

      if (hasCoreColumns && hasTimeColumns) {
        headerLineIndex = i;
        delimiter = candidateDelimiter;
        columnIndexes = indexes;
        break;
      }
    }

    if (headerLineIndex !== -1) break;
  }

  if (headerLineIndex === -1) {
    throw new Error(
      "Could not detect CSV header. Expected Date+Time (or Timestamp) and Voltage, Current, Power, Battery columns."
    );
  }

  const {
    voltageIdx,
    currentIdx,
    powerIdx,
    batteryIdx,
    timestampIdx,
    dateIdx,
    timeIdx,
  } = columnIndexes;

  const parsed: Array<Omit<PowerReading, "id">> = [];

  for (let lineNo = headerLineIndex + 1; lineNo < lines.length; lineNo += 1) {
    const cells = parseCsvLine(lines[lineNo], delimiter);

    if (
      voltageIdx === undefined ||
      currentIdx === undefined ||
      powerIdx === undefined ||
      batteryIdx === undefined
    ) {
      continue;
    }

    const rawTimestamp = timestampIdx !== undefined
      ? cells[timestampIdx]
      : `${cells[dateIdx as number]} ${cells[timeIdx as number]}`;

    const date = new Date(rawTimestamp);
    const voltage = parseNumber(cells[voltageIdx] ?? "");
    const current = parseNumber(cells[currentIdx] ?? "");
    const power = parseNumber(cells[powerIdx] ?? "");
    const batteryPercent = parseNumber(cells[batteryIdx] ?? "");

    if (
      Number.isNaN(date.getTime()) ||
      Number.isNaN(voltage) ||
      Number.isNaN(current) ||
      Number.isNaN(power) ||
      Number.isNaN(batteryPercent)
    ) {
      continue;
    }

    parsed.push({
      timestamp: date.toISOString(),
      voltage,
      current,
      power,
      battery_percent: batteryPercent,
    });
  }

  if (parsed.length === 0) {
    throw new Error("No valid data rows found in CSV after parsing.");
  }

  return parsed;
}

// ── CSV download helper ──────────────────────────────────────────────────────
function downloadCsv(rows: PowerReading[]): void {
  const header = "id,timestamp,voltage,current,power,battery_percent";
  const body = rows
    .map((r) =>
      [r.id, r.timestamp, r.voltage, r.current, r.power, r.battery_percent].join(",")
    )
    .join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hyeblis-data-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page title map ────────────────────────────────────────────────────────────
const PAGE_TITLE: Record<Page, string> = {
  home:  "Home",
  graph: "Real-time Data Graph",
  log:   "Data Log",
};

// ── Component ─────────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>("home");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { latest, history, status, lastUpdated, refreshLatest } = usePowerData();
  const { rows, status: histStatus, refresh } = useHistoryData();

  const graphHistory = useMemo(() => {
    if (rows.length > 0) {
      return rows;
    }
    return history;
  }, [rows, history]);

  const handleRefresh = useCallback(() => {
    refresh();
    void refreshLatest();
  }, [refresh, refreshLatest]);

  const handleDownload = useCallback(() => downloadCsv(rows), [rows]);

  const handleSecretImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSecretClearClick = useCallback(async () => {
    const approved = window.confirm("Clear all stored data?");
    if (!approved) return;

    try {
      let res = await fetch(`${API_BASE}/history/clear`, { method: "POST" });
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`${API_BASE}/history`, { method: "DELETE" });
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? `Clear failed with HTTP ${res.status}`);
      }

      await refresh();
      await refreshLatest();
    } catch (error) {
      console.error("[Dashboard] clear error", error);
      alert(error instanceof Error ? error.message : "Failed to clear data.");
    }
  }, [refresh, refreshLatest]);

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        let res = await fetch(`${API_BASE}/import-file`, {
          method: "POST",
          body: formData,
        });

        if (res.status === 404 || res.status === 405) {
          const text = await file.text();
          const parsedRows = parseCsvRows(text);
          res = await fetch(`${API_BASE}/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: parsedRows }),
          });
        }

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error ?? `Import failed with HTTP ${res.status}`);
        }

        await refresh();
        await refreshLatest();
      } catch (error) {
        console.error("[Dashboard] import error", error);
        alert(error instanceof Error ? error.message : "Failed to import CSV.");
      } finally {
        event.target.value = "";
      }
    },
    [refresh, refreshLatest]
  );

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onRefresh={handleRefresh}
        onDownload={handleDownload}
      />

      <div className="main-content">
        {/* ── Header ────────────────────────────────────────────────── */}
        <header className="dashboard__header">
          <h1 className="dashboard__title">
            <span className="dashboard__title-accent">HYEBLiS</span>
            &nbsp;{PAGE_TITLE[activePage]}
          </h1>
          <StatusBar status={status} lastUpdated={lastUpdated} />
        </header>

        {/* ── Home ──────────────────────────────────────────────────── */}
        {activePage === "home" && (
          <main className="home-circle-page">
            <section className="home-circle-grid" aria-label="Live metrics">
              <article className="metric-circle metric-circle--primary">
                <span className="metric-circle__label">Voltage</span>
                <span className="metric-circle__value">
                  {latest?.voltage !== undefined ? latest.voltage.toFixed(3) : "—"}
                  <span className="metric-circle__unit">V</span>
                </span>
              </article>

              <article className="metric-circle metric-circle--warning">
                <span className="metric-circle__label">Current</span>
                <span className="metric-circle__value">
                  {latest?.current !== undefined ? latest.current.toFixed(4) : "—"}
                  <span className="metric-circle__unit">A</span>
                </span>
              </article>

              <article className="metric-circle metric-circle--danger">
                <span className="metric-circle__label">Power</span>
                <span className="metric-circle__value">
                  {latest?.power !== undefined ? latest.power.toFixed(3) : "—"}
                  <span className="metric-circle__unit">W</span>
                </span>
              </article>

              <article className="metric-circle metric-circle--success">
                <span className="metric-circle__label">Battery</span>
                <span className="metric-circle__value">
                  {latest?.battery_percent !== undefined ? latest.battery_percent.toFixed(1) : "—"}
                  <span className="metric-circle__unit">%</span>
                </span>
              </article>
            </section>
          </main>
        )}

        {/* ── Real-time Graph ───────────────────────────────────────── */}
        {activePage === "graph" && (
          <div className="page page--graph">
            <section className="metric-grid metric-grid--compact">
              <MetricCard label="Voltage"  value={latest?.voltage         ?? null} unit="V" decimals={3} accent="primary" />
              <MetricCard label="Current"  value={latest?.current         ?? null} unit="A" decimals={4} accent="warning" />
              <MetricCard label="Power"    value={latest?.power           ?? null} unit="W" decimals={3} accent="danger"  />
              <MetricCard label="Battery"  value={latest?.battery_percent ?? null} unit="%" decimals={1} accent="success" />
            </section>
            <section className="chart-section chart-section--expanded">
              <h2 className="chart-section__title">Voltage &amp; Power — Live</h2>
              <PowerChart history={graphHistory} />
            </section>
          </div>
        )}

        {/* ── Data Log ──────────────────────────────────────────────── */}
        {activePage === "log" && (
          <div className="page page--log">
            <DataLog rows={rows} loading={histStatus === "loading"} />
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className="dashboard__footer">
          Raspberry Pi&nbsp;·&nbsp;INA219&nbsp;·&nbsp;SQLite&nbsp;·&nbsp;Flask
        </footer>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleImportFile}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="secret-hitbox secret-hitbox--clear"
          onClick={handleSecretClearClick}
          aria-label="Clear all data"
        />
        <button
          type="button"
          className="secret-hitbox secret-hitbox--import"
          onClick={handleSecretImportClick}
          aria-label="Import CSV data"
        />
      </div>
    </div>
  );
};

export default Dashboard;

