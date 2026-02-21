// src/hooks/usePowerData.ts – Polls /latest and maintains a rolling history buffer

import { useCallback, useEffect, useRef, useState } from "react";
import type { FetchStatus, PowerReading } from "../types";

// In development the Vite proxy forwards /latest and /history to Flask.
// For production builds deployed to a different origin, set VITE_API_BASE_URL
// (e.g. VITE_API_BASE_URL=http://raspberrypi.local:5000).
const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "";

const POLL_MS = 3_000;       // match backend POLL_INTERVAL_SECONDS
const MAX_HISTORY = 120;     // keep ~6 minutes of data in memory

interface UsePowerDataReturn {
  latest: PowerReading | null;
  history: PowerReading[];
  status: FetchStatus;
  lastUpdated: Date | null;
}

export function usePowerData(): UsePowerDataReturn {
  const [latest, setLatest] = useState<PowerReading | null>(null);
  const [history, setHistory] = useState<PowerReading[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track last seen ID so we don't append duplicates
  const lastIdRef = useRef<number | null>(null);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/latest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PowerReading = await res.json();

      setLatest(data);
      setStatus("ok");
      setLastUpdated(new Date());

      // Append to rolling history only when we get a new reading
      if (data.id !== lastIdRef.current) {
        lastIdRef.current = data.id;
        setHistory((prev) => {
          const next = [...prev, data];
          return next.length > MAX_HISTORY
            ? next.slice(next.length - MAX_HISTORY)
            : next;
        });
      }
    } catch (err) {
      console.error("[usePowerData] fetch error:", err);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    setStatus("loading");
    fetchLatest();
    const id = setInterval(fetchLatest, POLL_MS);
    return () => clearInterval(id);
  }, [fetchLatest]);

  return { latest, history, status, lastUpdated };
}
