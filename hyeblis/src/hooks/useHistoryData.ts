// src/hooks/useHistoryData.ts – On-demand history fetch with manual refresh

import { useCallback, useEffect, useState } from "react";
import type { FetchStatus, PowerReading } from "../types";

const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "";
const HISTORY_LIMIT = 50_000; // large cap; server clamps to 10 000

interface UseHistoryDataReturn {
  rows: PowerReading[];
  status: FetchStatus;
  refresh: () => void;
}

export function useHistoryData(): UseHistoryDataReturn {
  const [rows, setRows] = useState<PowerReading[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/history?limit=${HISTORY_LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PowerReading[] = await res.json();
      setRows(data);
      setStatus("ok");
    } catch (err) {
      console.error("[useHistoryData]", err);
      setStatus("error");
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => { refresh(); }, [refresh]);

  return { rows, status, refresh };
}
