import { execSync } from 'node:child_process';
import { loadSettings, saveSettings } from './db.mjs';

let availableEncodersCache = null;

export function getAvailableEncoders() {
  if (availableEncodersCache) return availableEncodersCache;
  const encoders = ['libx264']; // Always available CPU fallback
  try {
    const stdout = execSync('ffmpeg -encoders', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (stdout.includes('h264_nvenc')) encoders.push('h264_nvenc');
    if (stdout.includes('hevc_nvenc')) encoders.push('hevc_nvenc');
    if (stdout.includes('h264_qsv')) encoders.push('h264_qsv');
  } catch (e) {}
  availableEncodersCache = encoders;
  return encoders;
}

export const defaultConfig = {
  selectedSource: 'GAMINGPC (NVIDIA GeForce RTX 3070 1)',
  previewEnabled: true,
  autoRecordOnNdi: true,
  replayBufferMinutes: 5,
  apiKey: process.env.API_KEY || 'ndi_secret_key_12345',
  sourceProfiles: {
    'prof-1': {
      id: 'prof-1',
      name: 'Profil Gaming PC',
      source: 'GAMINGPC (NVIDIA GeForce RTX 3070 1)',
      autoRecord: true,
      replayBufferMinutes: 5,
      bitrateMbps: 12,
      encoder: 'libx264',
      recordDir: '',
      clipDir: '',
      maxRecordSizeMb: 0,
      maxClipSizeMb: 0
    }
  },
  recordingDir: process.env.RECORDING_DIR || './recordings',
  clipsDir: process.env.CLIPS_DIR || './clips',
  ndiAccessIps: process.env.NDI_ACCESS_IPS ? process.env.NDI_ACCESS_IPS.split(',') : ['192.168.1.148', '192.168.1.129', '192.168.1.100'],
  video: {
    resolution: '1080p',
    fps: 60,
    encoder: 'h264_nvenc', // 'h264_nvenc', 'libx264', 'hevc_nvenc', 'h264_qsv'
    bitrateMbps: 12,
    preset: 'hq'
  },
  audio: {
    channels: 'stereo', // 'stereo', 'mono', 'multichannel'
    bitrateKbps: 192,
    sourceTracks: ['Track 1 (Master)', 'Track 2 (Mic)']
  },
  fireshare: {
    enabled: true,
    apiUrl: process.env.FIRESHARE_API_URL || 'http://localhost:8080',
    autoScan: true
  }
};

function mergeConfig(base, newSettings) {
  if (!newSettings || typeof newSettings !== 'object') return { ...base };

  let updatedProfiles = base.sourceProfiles || {};

  if (newSettings.sourceProfiles) {
    updatedProfiles = { ...updatedProfiles };
    for (const [id, prof] of Object.entries(newSettings.sourceProfiles)) {
      if (prof === null) {
        delete updatedProfiles[id];
      } else {
        const existing = updatedProfiles[id] || {
          id,
          name: prof.name || id,
          source: prof.source || '',
          autoRecord: false,
          replayBufferMinutes: 5,
          bitrateMbps: 12,
          encoder: 'libx264',
          recordDir: '',
          clipDir: '',
          maxRecordSizeMb: 0,
          maxClipSizeMb: 0
        };
        const merged = { ...existing, ...prof };

        // Enforce exclusivity: if merged.autoRecord is true, turn autoRecord OFF for all other profiles targeting the same NDI source
        if (merged.autoRecord && merged.source) {
          for (const [otherId, otherProf] of Object.entries(updatedProfiles)) {
            if (otherId !== id && otherProf && otherProf.source === merged.source) {
              updatedProfiles[otherId] = { ...otherProf, autoRecord: false };
            }
          }
        }
        updatedProfiles[id] = merged;
      }
    }
  }

  return {
    ...base,
    ...newSettings,
    sourceProfiles: updatedProfiles,
    video: { ...base.video, ...(newSettings.video || {}) },
    audio: { ...base.audio, ...(newSettings.audio || {}) },
    fireshare: { ...base.fireshare, ...(newSettings.fireshare || {}) }
  };
}

let currentConfig = { ...defaultConfig };

try {
  const persisted = loadSettings('config');
  if (persisted && typeof persisted === 'object') {
    currentConfig = mergeConfig(currentConfig, persisted);
  }
} catch (e) {}

export function getConfig() {
  return currentConfig;
}

export function updateConfig(newSettings) {
  currentConfig = mergeConfig(currentConfig, newSettings);
  saveSettings('config', currentConfig);
  return currentConfig;
}
