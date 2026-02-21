// src/components/MetricCard.tsx – Displays a single numeric metric

import React from "react";

interface MetricCardProps {
  label: string;
  value: number | null;
  unit: string;
  /** Decimal places to show; default 2 */
  decimals?: number;
  /** Optional colour accent: primary | warning | success | danger */
  accent?: "primary" | "warning" | "success" | "danger";
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  decimals = 2,
  accent = "primary",
}) => {
  const display =
    value !== null ? value.toFixed(decimals) : "—";

  return (
    <div className={`metric-card metric-card--${accent}`}>
      <span className="metric-card__label">{label}</span>
      <span className="metric-card__value">
        {display}
        <span className="metric-card__unit">{unit}</span>
      </span>
    </div>
  );
};

export default MetricCard;
