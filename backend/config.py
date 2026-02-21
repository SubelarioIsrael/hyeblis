# config.py – Central configuration for HYEBLiS monitor

import os

# ── I2C / Sensor ──────────────────────────────────────────────────────────────
INA219_ADDRESS: int = int(os.getenv("INA219_ADDRESS", "0x40"), 16)
# Max expected current in amps (used to configure the INA219 shunt)
MAX_EXPECTED_CURRENT_A: float = float(os.getenv("MAX_EXPECTED_CURRENT_A", "3.2"))

# ── Sampling ──────────────────────────────────────────────────────────────────
POLL_INTERVAL_SECONDS: float = float(os.getenv("POLL_INTERVAL_SECONDS", "3"))

# ── Battery ───────────────────────────────────────────────────────────────────
# Voltage thresholds for a single-cell LiPo / LiFePO4 pack.
# Adjust to match your battery chemistry and string count.
BATTERY_VOLTAGE_MAX: float = float(os.getenv("BATTERY_VOLTAGE_MAX", "14.6"))
BATTERY_VOLTAGE_MIN: float = float(os.getenv("BATTERY_VOLTAGE_MIN", "11.0"))

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH: str = os.getenv("DB_PATH", "/var/lib/hyeblis/hyeblis.db")

# ── API ───────────────────────────────────────────────────────────────────────
API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
API_PORT: int = int(os.getenv("API_PORT", "5000"))

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE: str = os.getenv("LOG_FILE", "/var/log/hyeblis/hyeblis.log")
