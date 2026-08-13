# ndi-dockrecorder

Headless Docker container that records NDI streams with a replay buffer, Stream Deck integration and Fireshare output. A web dashboard is exposed on port 3000.

## Features

- **NDI recording** - captures any NDI source on the local network
- **Replay buffer** - keeps a rolling window of 5/10/15 min in RAM (tmpfs), save a clip on demand
- **Stream Deck** - REST shortcuts to toggle recording and save clips without opening the dashboard
- **Hardware encoding** - uses Intel QSV (`h264_qsv`) when `/dev/dri` is available, falls back to `libx264` automatically
- **Per-source profiles** - different output directories, bitrates and auto-record rules per NDI source
- **Fireshare output** - writes files directly into a Fireshare watch directory
- **API key protection** - optional `X-Api-Key` header on all API endpoints

---

## Installation

### Option 1 - Docker Compose (recommended)

**Prerequisites:** Docker + Docker Compose installed on a Linux host.

```bash
git clone https://github.com/JamesDAdams/ndi-recorder.git
cd ndi-recorder
```

Edit `docker-compose.yml` to set your NDI source IPs and output paths, then:

```bash
docker compose up -d
```

Open `http://<host-ip>:3000` in your browser.

> **Note:** `network_mode: host` is required for NDI mDNS/multicast discovery. The container shares the host network stack.

#### docker-compose.yml reference

```yaml
services:
  ndi-dockrecorder:
    image: ghcr.io/jamesdadams/ndi-recorder:latest
    container_name: ndi-dockrecorder
    network_mode: host
    restart: unless-stopped
    devices:
      - /dev/dri:/dev/dri          # Intel iGPU for hardware encoding - remove if not available
    environment:
      - PORT=3000
      - REPLAY_BUFFER_MINUTES=5    # 5, 10 or 15
      - RECORDING_DIR=/media/fireshare/watch
      - SETTINGS_DB=/app/data/settings.db
      - NDI_ACCESS_IPS=192.168.1.10,192.168.1.20   # comma-separated, leave empty to allow all
    tmpfs:
      - /tmp/replay_buffer:size=2G,mode=777
    volumes:
      - ./recordings:/media/fireshare/watch
      - ./data:/app/data
      - ./config:/app/config
```

#### Update

```bash
docker compose pull && docker compose up -d
```

---

### Option 2 - Docker run (single command)

```bash
docker run -d \
  --name ndi-dockrecorder \
  --network host \
  --restart unless-stopped \
  --device /dev/dri:/dev/dri \
  --tmpfs /tmp/replay_buffer:size=2147483648,mode=777 \
  -e PORT=3000 \
  -e REPLAY_BUFFER_MINUTES=5 \
  -e RECORDING_DIR=/media/fireshare/watch \
  -e SETTINGS_DB=/app/data/settings.db \
  -e NDI_ACCESS_IPS=192.168.1.10,192.168.1.20 \
  -v /path/to/recordings:/media/fireshare/watch \
  -v /path/to/data:/app/data \
  -v /path/to/config:/app/config \
  ghcr.io/jamesdadams/ndi-recorder:latest
```

Remove `--device /dev/dri:/dev/dri` if your host has no Intel iGPU - the container will fall back to software encoding automatically.

---

### Option 3 - Unraid

Run this command in the Unraid terminal:

```bash
wget -O /boot/config/plugins/dockerMan/templates-user/ndi-dockrecorder.xml \
  https://raw.githubusercontent.com/JamesDAdams/ndi-recorder/main/ndi-dockrecorder.xml
```

Then go to **Docker** -> **Add Container** - the template will appear in the dropdown. Adjust the paths to match your share layout and click **Apply**.

#### Unraid-specific notes

| Setting | Recommended value |
|---|---|
| Recordings path | `/mnt/user/recordings/ndi` |
| Data path | `/mnt/user/appdata/ndi-dockrecorder/data` |
| Config path | `/mnt/user/appdata/ndi-dockrecorder/config` |
| Network type | **Host** (mandatory for NDI) |
| Extra parameters | `--device /dev/dri:/dev/dri --tmpfs /tmp/replay_buffer:size=2147483648,mode=777` |

> **Intel iGPU on Unraid:** the `--device /dev/dri:/dev/dri` extra parameter passes through the Intel GPU for hardware encoding. Remove it if your server has no Intel iGPU (AMD, ARM, or no GPU).

> **Replay buffer RAM:** the `--tmpfs` parameter allocates 2 GB of RAM for the buffer. Adjust `size=` to fit your server's available memory and buffer duration.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the web server listens on |
| `REPLAY_BUFFER_MINUTES` | `5` | Rolling buffer duration (5, 10 or 15) |
| `RECORDING_DIR` | `/media/fireshare/watch` | Default output directory for recordings |
| `SETTINGS_DB` | `/app/data/settings.db` | Path to the SQLite database |
| `NDI_ACCESS_IPS` | _(empty)_ | Comma-separated IPs allowed to send NDI - leave empty to allow all |

---

## Volumes

| Container path | Purpose |
|---|---|
| `/media/fireshare/watch` | Recording output (full recordings and clips) |
| `/app/data` | Persistent settings database (`settings.db`) |
| `/app/config` | NDI Access Manager configuration |

---

## Stream Deck API

All endpoints require the `X-Api-Key` header if an API key is configured in the dashboard.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/streamdeck/toggle-rec` | Start or stop recording |
| `POST` | `/api/streamdeck/clip-5min` | Save the last 5 min from the replay buffer |
| `POST` | `/api/streamdeck/clip?minutes=10` | Save the last N min (5, 10 or 15) |
| `GET` | `/api/status` | Current recording and buffer status |

---

## Hardware encoding

| GPU | Encoder | Requirement |
|---|---|---|
| Intel iGPU (6th gen+) | `h264_qsv` | `/dev/dri` device passed through |
| NVIDIA | `h264_nvenc` | Requires nvidia-container-toolkit (not included) |
| None / fallback | `libx264` | Always available, higher CPU usage |

The encoder is selected automatically based on what is available at runtime.

---

## Building from source

```bash
git clone https://github.com/JamesDAdams/ndi-recorder.git
cd ndi-recorder
docker build -t ndi-dockrecorder .
```

The Dockerfile downloads and installs the official NDI SDK v6 for Linux during the build.
