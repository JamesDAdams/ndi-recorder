import fs from 'fs';
import path from 'path';

export class FireshareExporter {
  constructor(config) {
    this.config = config;
  }

  generateFilename(sourceName, prefix = 'REPLAY', type = 'clip') {
    const now = new Date();
    const dateStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
    const safeSource = (sourceName || 'NDI').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${dateStr}_${safeSource}_${prefix}_${type}.mp4`;
  }

  getProfileForSource(sourceName) {
    if (!sourceName) return null;
    const profiles = this.config.sourceProfiles || {};
    return Object.values(profiles).find(p => p && p.source === sourceName) || null;
  }

  getOutputPath(filename, sourceName, type = 'full') {
    let outputDir = this.config.recordingDir || './recordings';
    const profile = this.getProfileForSource(sourceName);
    if (profile) {
      const profileDir = type === 'clip' ? profile.clipDir : profile.recordDir;
      if (profileDir && profileDir.trim()) outputDir = profileDir;
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    return path.join(outputDir, filename);
  }

  async notifyFireshare(filename) {
    if (!this.config.fireshare?.enabled) return { skipped: true };

    const targetUrl = `${this.config.fireshare.apiUrl}/api/v1/videos/scan`;
    try {
      // Send scan notification to Fireshare endpoint
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      return { success: response.ok, status: response.status };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}
