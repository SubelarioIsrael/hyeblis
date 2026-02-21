// src/components/Dashboard.tsx – App shell with sidebar + page routing

import React, { useCallback, useState } from "react";
import DataLog from "./DataLog";
import MetricCard from "./MetricCard";
import PowerChart from "./PowerChart";
import Sidebar, { type Page } from "./Sidebar";
import StatusBar from "./StatusBar";
import { useHistoryData } from "../hooks/useHistoryData";
import { usePowerData } from "../hooks/usePowerData";
import type { PowerReading } from "../types";

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
  const { latest, history, status, lastUpdated } = usePowerData();
  const { rows, status: histStatus, refresh } = useHistoryData();

  const handleDownload = useCallback(() => downloadCsv(rows), [rows]);

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onRefresh={refresh}
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
          <div className="page page--home">
            <section className="metric-grid">
              <MetricCard label="Voltage"  value={latest?.voltage         ?? null} unit="V" decimals={3} accent="primary" />
              <MetricCard label="Current"  value={latest?.current         ?? null} unit="A" decimals={4} accent="warning" />
              <MetricCard label="Power"    value={latest?.power           ?? null} unit="W" decimals={3} accent="danger"  />
              <MetricCard label="Battery"  value={latest?.battery_percent ?? null} unit="%" decimals={1} accent="success" />
            </section>
            <section className="chart-section">
              <h2 className="chart-section__title">Voltage &amp; Power — Live</h2>
              <PowerChart history={history} />
            </section>
          </div>
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
              <PowerChart history={history} />
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
      </div>
    </div>
  );
};

export default Dashboard;

