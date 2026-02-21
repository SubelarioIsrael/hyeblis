// src/components/PowerChart.tsx – Real-time line chart (voltage & power)

import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { PowerReading } from "../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PowerChartProps {
  history: PowerReading[];
}

const OPTIONS: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 },   // disable animation for real-time feel
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      position: "top",
      labels: { color: "#cbd5e1", font: { size: 12 } },
    },
    tooltip: {
      backgroundColor: "#1e293b",
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
    },
  },
  scales: {
    x: {
      ticks: {
        color: "#64748b",
        maxTicksLimit: 8,
        maxRotation: 0,
      },
      grid: { color: "#1e293b" },
    },
    voltage: {
      type: "linear",
      position: "left",
      title: { display: true, text: "Voltage (V)", color: "#38bdf8" },
      ticks: { color: "#38bdf8" },
      grid: { color: "#1e293b" },
    },
    power: {
      type: "linear",
      position: "right",
      title: { display: true, text: "Power (W)", color: "#f97316" },
      ticks: { color: "#f97316" },
      grid: { drawOnChartArea: false },
    },
  },
};

const PowerChart: React.FC<PowerChartProps> = ({ history }) => {
  const data = useMemo(() => {
    const labels = history.map((r) => {
      const d = new Date(r.timestamp);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    });

    return {
      labels,
      datasets: [
        {
          label: "Voltage (V)",
          data: history.map((r) => r.voltage),
          yAxisID: "voltage",
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56,189,248,0.08)",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        },
        {
          label: "Power (W)",
          data: history.map((r) => r.power),
          yAxisID: "power",
          borderColor: "#f97316",
          backgroundColor: "rgba(249,115,22,0.08)",
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
      ],
    };
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>Waiting for data…</p>
      </div>
    );
  }

  return (
    <div className="chart-wrapper">
      <Line data={data} options={OPTIONS} />
    </div>
  );
};

export default PowerChart;
