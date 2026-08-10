import { EventEmitter } from 'events';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function resolveNdiCaptureBin() {
  if (process.env.NDI_CAPTURE_BIN && fs.existsSync(process.env.NDI_CAPTURE_BIN)) {
    return process.env.NDI_CAPTURE_BIN;
  }
  const candidates = [
    '/usr/local/bin/ndi_capture',
    path.join(process.cwd(), 'bin', 'ndi_capture')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export class NdiManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.discoveredSources = [];
    this.customSources = ['GAMINGPC (NVIDIA GeForce RTX 3070 1)'];
    this.activeSource = config.selectedSource || 'GAMINGPC (NVIDIA GeForce RTX 3070 1)';
    this.isStreamActive = false;

    this.setupNdiAccessConfig();
    this.scanSources();
  }

  setupNdiAccessConfig() {
    const ips = (this.config.ndiAccessIps && this.config.ndiAccessIps.length > 0)
      ? this.config.ndiAccessIps
      : ['192.168.1.148', '192.168.1.129'];

    const ndiConfig = {
      ndi: {
        networks: {
          ips: ips.join(',')
        }
      }
    };

    const targetPaths = [
      '/root/.ndi/ndi-config.v1.json',
      '/etc/ndi/ndi-config.v1.json',
      path.join(process.env.NDI_CONFIG_DIR || './config', 'ndi-config.v1.json')
    ];

    for (const configPath of targetPaths) {
      try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(ndiConfig, null, 2));
      } catch (e) {}
    }
  }

  scanSources() {
    const sources = new Set(this.customSources);

    // 0. Discover via native NDI SDK helper (ndi_capture --find) — works on macOS & Linux
    const ndiCaptureBin = resolveNdiCaptureBin();
    if (ndiCaptureBin) {
      try {
        const result = spawnSync(ndiCaptureBin, ['--find'], { timeout: 4000 });
        if (result.status === 0) {
          const output = result.stdout.toString().split('\n');
          for (const line of output) {
            const name = line.trim();
            if (name) sources.add(name);
          }
        }
      } catch (err) {}
    }

    // 1. Discover NDI services via avahi-browse
    try {
      const output = execSync('avahi-browse -r -t -p _ndi._tcp 2>/dev/null', { timeout: 2000 }).toString();
      const lines = output.split('\n');

      for (const line of lines) {
        if (line.startsWith('=')) {
          const parts = line.split(';');
          if (parts[3]) {
            sources.add(parts[3]);
          }
        }
      }
    } catch (err) {}

    // 2. Discover via FFmpeg NDI find_sources (only if ffmpeg has libndi)
    try {
      const ffmpegOutput = execSync('ffmpeg -hide_banner -f libndi_newtek -find_sources 1 -i dummy 2>&1', { timeout: 3000 }).toString();
      const matches = ffmpegOutput.match(/\[\d+\]\s+(.+)/g);
      if (matches) {
        for (const m of matches) {
          const cleanName = m.replace(/\[\d+\]\s+/, '').trim();
          if (cleanName) sources.add(cleanName);
        }
      }
    } catch (err) {}

    this.discoveredSources = Array.from(sources);

    if (!this.discoveredSources.includes(this.activeSource)) {
      this.activeSource = this.discoveredSources.length > 0 ? this.discoveredSources[0] : (this.activeSource || null);
    }
  }

  addCustomSource(sourceName) {
    if (sourceName && !this.customSources.includes(sourceName)) {
      this.customSources.push(sourceName);
      this.activeSource = sourceName;
      this.scanSources();
      return true;
    }
    return false;
  }

  getSources() {
    this.scanSources();
    return this.discoveredSources;
  }

  setSource(sourceName) {
    this.activeSource = sourceName;
    if (sourceName && !this.customSources.includes(sourceName) && !this.discoveredSources.includes(sourceName)) {
      this.customSources.push(sourceName);
    }
    this.emit('sourceChanged', sourceName);
    return true;
  }

  simulateStreamDetection(sourceName, active = true) {
    this.isStreamActive = active;
    if (active) {
      this.activeSource = sourceName;
      if (!this.discoveredSources.includes(sourceName)) {
        this.discoveredSources.push(sourceName);
      }
      this.emit('ndiSignalDetected', sourceName);
    } else {
      this.emit('ndiSignalLost', sourceName);
    }
  }
}
