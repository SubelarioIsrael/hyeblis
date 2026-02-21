// src/components/StatusBar.tsx – Connection status indicator

import React from "react";
import type { FetchStatus } from "../types";

interface StatusBarProps {
  status: FetchStatus;
  lastUpdated: Date | null;
}

const STATUS_TEXT: Record<FetchStatus, string> = {
  idle: "Waiting…",
  loading: "Connecting…",
  ok: "Live",
  error: "Connection error – retrying",
};

const StatusBar: React.FC<StatusBarProps> = ({ status, lastUpdated }) => {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString()
    : "—";

  return (
    <div className={`status-bar status-bar--${status}`}>
      <span className="status-bar__dot" />
      <span className="status-bar__text">{STATUS_TEXT[status]}</span>
      {lastUpdated && (
        <span className="status-bar__time">Last update: {timeStr}</span>
      )}
    </div>
  );
};

export default StatusBar;
