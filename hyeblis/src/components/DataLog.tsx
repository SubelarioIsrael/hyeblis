// src/components/DataLog.tsx – Tabular history view with period filter

import React, { useMemo, useState } from "react";
import type { PowerReading } from "../types";

type Period = "day" | "month" | "year";

interface DataLogProps {
  rows: PowerReading[];
  loading: boolean;
}

function filterByPeriod(rows: PowerReading[], period: Period): PowerReading[] {
  const now = new Date();
  return rows.filter((r) => {
    const d = new Date(r.timestamp);
    if (period === "day") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
    if (period === "month") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    }
    // year
    return d.getFullYear() === now.getFullYear();
  });
}

const PERIODS: { id: Period; label: string }[] = [
  { id: "day",   label: "Day"   },
  { id: "month", label: "Month" },
  { id: "year",  label: "Year"  },
];

const DataLog: React.FC<DataLogProps> = ({ rows, loading }) => {
  const [period, setPeriod] = useState<Period>("day");

  const filtered = useMemo(
    () => filterByPeriod(rows, period).slice().reverse(), // newest first
    [rows, period]
  );

  return (
    <div className="data-log">
      {/* Period filter */}
      <div className="data-log__toolbar">
        <span className="data-log__toolbar-label">Filter by:</span>
        <div className="data-log__period-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={`data-log__period-btn${period === p.id ? " data-log__period-btn--active" : ""}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="data-log__count">
          {loading ? "Loading…" : `${filtered.length} record${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Table */}
      <div className="data-log__scroll">
        <table className="data-log__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Timestamp</th>
              <th>Voltage (V)</th>
              <th>Current (A)</th>
              <th>Power (W)</th>
              <th>Battery (%)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="data-log__empty">
                  {loading ? "Loading data…" : "No records for this period."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td className="data-log__id">{r.id}</td>
                  <td className="data-log__ts">
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                  <td>{r.voltage.toFixed(3)}</td>
                  <td>{r.current.toFixed(4)}</td>
                  <td>{r.power.toFixed(3)}</td>
                  <td>
                    <span
                      className={`data-log__battery ${
                        r.battery_percent >= 60
                          ? "data-log__battery--high"
                          : r.battery_percent >= 20
                          ? "data-log__battery--mid"
                          : "data-log__battery--low"
                      }`}
                    >
                      {r.battery_percent.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataLog;
