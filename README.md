# ndi-dockrecorder

Headless Docker container that records NDI streams with a replay buffer, Stream Deck integration and Fireshare output. A web dashboard is exposed on port 3000.

## Features

- **NDI recording** - captures any NDI source on the local network
- **Replay buffer** - keeps a rolling window in RAM (tmpfs), save a clip on demand
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
      # Intel iGPU passthrough for hardware encoding (h264_qsv).
      # Remove this line if your host has no Intel iGPU — libx264 fallback is automatic.
      - /dev/dri:/dev/dri
    environment:
      - PORT=3000
      - NDI_ACCESS_IPS=192.168.1.10,192.168.1.20
    tmpfs:
      # Replay buffer stored in RAM. At 1080p60 (~12 Mbps h264), 1 GB = ~11 min of buffer.
      # 2G = ~22 min, 4G = ~44 min. Adjust to your needs.
      - /tmp/replay_buffer:size=2G,mode=777
    volumes:
      - ./recordings:/media
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
  -e NDI_ACCESS_IPS=192.168.1.10,192.168.1.20 \
  -v /path/to/recordings:/media \
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

> **Intel iGPU on Unraid:** remove `--device /dev/dri:/dev/dri` from Extra parameters if your server has no Intel iGPU.

> **Replay buffer RAM:** at 1080p60 (~12 Mbps h264), 1 GB = ~11 min of buffer. 2 GB = ~22 min, 4 GB = ~44 min. Adjust `size=` in the Extra parameters accordingly.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the web server listens on |
| `NDI_ACCESS_IPS` | _(empty)_ | Comma-separated IPs allowed to send NDI - leave empty to allow all |

---

## Volumes

| Container path | Purpose |
|---|---|
| `/media` | Recording output (full recordings and clips) |
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
