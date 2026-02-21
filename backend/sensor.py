# sensor.py – INA219 sensor abstraction for HYEBLiS monitor
#
# On real hardware this wraps the pi-ina219 library.
# When the library is unavailable (dev / CI) a software simulation is used
# so the rest of the stack can be tested without physical hardware.

from __future__ import annotations

import logging
import math
import random
import time
from dataclasses import dataclass

import config

logger = logging.getLogger(__name__)


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class SensorReading:
    voltage: float          # Bus voltage in Volts
    current: float          # Current in Amperes
    power: float            # Power in Watts
    battery_percent: float  # State-of-charge 0–100 %


# ── Battery SoC helper ────────────────────────────────────────────────────────

def _voltage_to_battery_percent(voltage: float) -> float:
    """Linear interpolation between empty and full voltage thresholds."""
    span = config.BATTERY_VOLTAGE_MAX - config.BATTERY_VOLTAGE_MIN
    if span <= 0:
        return 0.0
    raw = (voltage - config.BATTERY_VOLTAGE_MIN) / span * 100.0
    return max(0.0, min(100.0, raw))


# ── Real INA219 driver ────────────────────────────────────────────────────────

class INA219Sensor:
    """Thin wrapper around the pi-ina219 library."""

    def __init__(self) -> None:
        try:
            from ina219 import INA219, DeviceRangeError  # type: ignore[import]
            self._DeviceRangeError = DeviceRangeError
            self._ina = INA219(
                shunt_ohms=0.1,
                max_expected_amps=config.MAX_EXPECTED_CURRENT_A,
                address=config.INA219_ADDRESS,
            )
            self._ina.configure()
            logger.info("INA219 sensor initialised at address 0x%02X", config.INA219_ADDRESS)
        except Exception as exc:
            logger.critical("Failed to initialise INA219: %s", exc)
            raise

    def read(self) -> SensorReading:
        try:
            voltage = self._ina.voltage()           # V
            current = self._ina.current() / 1000.0  # mA → A
            power = self._ina.power() / 1000.0      # mW → W
            if power == 0.0:
                power = voltage * current
            battery_pct = _voltage_to_battery_percent(voltage)
            return SensorReading(
                voltage=round(voltage, 4),
                current=round(current, 4),
                power=round(power, 4),
                battery_percent=round(battery_pct, 2),
            )
        except self._DeviceRangeError:
            logger.warning("INA219 device range exceeded – returning zeros")
            return SensorReading(voltage=0.0, current=0.0, power=0.0, battery_percent=0.0)


# ── Simulation driver (no hardware needed) ───────────────────────────────────

class SimulatedSensor:
    """Deterministic-ish simulation for development / testing."""

    def __init__(self) -> None:
        self._t0 = time.monotonic()
        logger.warning("Using SIMULATED sensor – no real hardware readings")

    def read(self) -> SensorReading:
        elapsed = time.monotonic() - self._t0
        voltage = 12.6 + 1.8 * math.sin(elapsed / 60) + random.gauss(0, 0.02)
        current = max(0.0, 1.2 + 0.4 * math.sin(elapsed / 30) + random.gauss(0, 0.05))
        power = voltage * current
        battery_pct = _voltage_to_battery_percent(voltage)
        return SensorReading(
            voltage=round(voltage, 4),
            current=round(current, 4),
            power=round(power, 4),
            battery_percent=round(battery_pct, 2),
        )


# ── Factory ───────────────────────────────────────────────────────────────────

def create_sensor() -> INA219Sensor | SimulatedSensor:
    """Return a real INA219 sensor, falling back to simulation if unavailable."""
    try:
        return INA219Sensor()
    except Exception:
        logger.warning("Falling back to simulated sensor")
        return SimulatedSensor()
