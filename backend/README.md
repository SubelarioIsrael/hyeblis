# HYEBLiS Backend – Raspberry Pi Setup

## Prerequisites

- Raspberry Pi OS (Bookworm or Bullseye)  
- Python 3.11+  
- I²C enabled (`sudo raspi-config` → Interface Options → I2C → Enable)

---

## 1 – Create system user and directories

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin hyeblis
sudo mkdir -p /opt/hyeblis /var/lib/hyeblis /var/log/hyeblis
sudo chown -R hyeblis:hyeblis /opt/hyeblis /var/lib/hyeblis /var/log/hyeblis
# Allow the hyeblis user to access I2C
sudo usermod -aG i2c hyeblis
```

---

## 2 – Deploy code

```bash
sudo cp -r backend/ /opt/hyeblis/backend
```

---

## 3 – Create virtual environment and install deps

```bash
sudo python3 -m venv /opt/hyeblis/venv
sudo /opt/hyeblis/venv/bin/pip install -r /opt/hyeblis/backend/requirements.txt
sudo chown -R hyeblis:hyeblis /opt/hyeblis/venv
```

---

## 4 – Install systemd service

```bash
sudo cp backend/hyeblis-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hyeblis-monitor
sudo systemctl start  hyeblis-monitor
```

### Check status / logs

```bash
sudo systemctl status hyeblis-monitor
journalctl -u hyeblis-monitor -f
```

---

## 5 – Verify API

```bash
curl http://localhost:5000/health
curl http://localhost:5000/latest
curl "http://localhost:5000/history?limit=10"
```

---

## Configuration

All settings can be overridden via environment variables (see `config.py` or the
`[Service]` section of the systemd unit):

| Variable | Default | Description |
|---|---|---|
| `INA219_ADDRESS` | `0x40` | I2C address of the INA219 |
| `MAX_EXPECTED_CURRENT_A` | `3.2` | Shunt calibration ceiling (A) |
| `POLL_INTERVAL_SECONDS` | `3` | Seconds between samples |
| `BATTERY_VOLTAGE_MAX` | `14.6` | Full-charge bus voltage (V) |
| `BATTERY_VOLTAGE_MIN` | `11.0` | Empty bus voltage (V) |
| `DB_PATH` | `/var/lib/hyeblis/hyeblis.db` | SQLite database path |
| `API_HOST` | `0.0.0.0` | Flask bind address |
| `API_PORT` | `5000` | Flask bind port |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
