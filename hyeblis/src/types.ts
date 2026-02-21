// src/types.ts – Shared TypeScript interfaces

export interface PowerReading {
  id: number;
  timestamp: string;       // ISO-8601 UTC
  voltage: number;         // Volts
  current: number;         // Amperes
  power: number;           // Watts
  battery_percent: number; // 0–100 %
}

export type FetchStatus = "idle" | "loading" | "ok" | "error";
