import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { spawnEncoder, resolveScale } from './encoder.mjs';

function runFfmpeg(args) {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => {
      if (code !== 0 && stderr) console.error('[ReplayBuffer] ffmpeg error:', stderr.slice(0, 500));
      resolve(code === 0);
    });
  });
}

export class ReplayBuffer {
  constructor(options = {}) {
    this.bufferDir = options.bufferDir || '/tmp/replay_buffer';
    this.durationMinutes = options.durationMinutes || 5;
    this.segmentTime = options.segmentTime || 2;
    this.forceLavfi = options.forceLavfi === true;
    this.isActive = false;
    this.segments = [];
    this.encoder = null;
    this.scanInterval = null;

    // Clean stale segments from previous runs
    if (fs.existsSync(this.bufferDir)) {
      for (const f of fs.readdirSync(this.bufferDir)) {
        if (/^segment_\d{5}\.ts$/.test(f) || /^segment_\d+_\d+\.ts$/.test(f) || f === 'segments.list' || f === 'concat_list.txt') {
          try { fs.unlinkSync(path.join(this.bufferDir, f)); } catch (e) {}
        }
      }
    } else {
      fs.mkdirSync(this.bufferDir, { recursive: true });
    }
  }

  start(sourceName, options = {}) {
    if (this.isActive) return;
    this.isActive = true;
    this.segments = [];

    const segmentPattern = path.join(this.bufferDir, 'segment_%05d.ts');
    const encoder = options.encoder || 'libx264';
    const preset = encoder.includes('nvenc') ? 'p4' : 'ultrafast';
    const bitrateMbps = options.bitrateMbps || 0;
    const bitrateArgs = bitrateMbps > 0 ? ['-b:v', `${bitrateMbps}M`] : [];

    const scaleTarget = resolveScale(options.recordQuality);
    const scaleArgs = scaleTarget ? ['-vf', `scale=${scaleTarget}`] : [];

    // Force a keyframe every segmentTime so the segment muxer cuts on IDR
    // boundaries and produces segments of the requested length
    const keyframeInterval = String(Math.max(1, Math.round(this.segmentTime * 30)));
    const gopArgs = encoder.includes('nvenc')
      ? ['-g', keyframeInterval]
      : ['-g', keyframeInterval, '-keyint_min', keyframeInterval, '-sc_threshold', '0'];

    this.encoder = spawnEncoder({
      sourceName,
      forceLavfi: this.forceLavfi,
      onFallback: options.onFallback || null,
      ffmpegArgs: [
        ...scaleArgs,
        '-r', '30',
        '-c:v', encoder,
        '-preset', preset,
        '-tune', 'zerolatency',
        ...gopArgs,
        ...bitrateArgs,
        '-f', 'segment',
        '-segment_time', String(this.segmentTime),
        '-segment_format', 'mpegts',
        segmentPattern
      ]
    });

    // Track completed segments by watching the buffer dir
    const knownFiles = new Set(
      fs.existsSync(this.bufferDir)
        ? fs.readdirSync(this.bufferDir).filter(f => f.endsWith('.ts'))
        : []
    );

    this.scanInterval = setInterval(() => {
      let files = [];
      try { files = fs.readdirSync(this.bufferDir).filter(f => /^segment_\d{5}\.ts$/.test(f)); } catch (e) { return; }

      // Only consider segments where ffmpeg has already moved on (exclude the last/in-flight one)
      const sorted = files.slice().sort();
      const complete = sorted.slice(0, -1);

      for (const f of complete) {
        if (knownFiles.has(f)) continue;
        knownFiles.add(f);
        const segPath = path.join(this.bufferDir, f);
        let size = 0;
        try { size = fs.statSync(segPath).size; } catch (e) {}
        if (size > 0) {
          this.segments.push({ path: segPath, timestamp: Date.now() });
        }
      }

      const cutoff = Date.now() - (this.durationMinutes * 60 * 1000);
      const keep = [];
      for (const seg of this.segments) {
        if (seg.timestamp < cutoff) {
          if (fs.existsSync(seg.path)) {
            try { fs.unlinkSync(seg.path); } catch (e) {}
          }
        } else {
          keep.push(seg);
        }
      }
      this.segments = keep;
    }, 1000);
    if (this.scanInterval.unref) this.scanInterval.unref();
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.scanInterval) clearInterval(this.scanInterval);
    if (this.encoder) this.encoder.stop();
    this.encoder = null;

    for (const seg of this.segments) {
      if (fs.existsSync(seg.path)) {
        try { fs.unlinkSync(seg.path); } catch (e) {}
      }
    }
    this.segments = [];
  }

  async saveReplay(outputFilePath, minutes = 5, maxSizeMb = 0) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const selectedSegments = this.segments.filter(s => s.timestamp >= cutoff);
    let duration = minutes * 60;
    if (selectedSegments.length > 0) {
      const newest = selectedSegments[selectedSegments.length - 1].timestamp;
      const oldest = selectedSegments[0].timestamp;
      duration = Math.min(duration, Math.max(1, Math.round((newest - oldest) / 1000)));
    }

    const targetDir = path.dirname(outputFilePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Select segments (capped by maxSizeMb, first segment always included).
    // Skip segments that are missing or empty (may have been pruned concurrently).
    const maxBytes = maxSizeMb > 0 ? maxSizeMb * 1024 * 1024 : 0;
    const chunks = [];
    let totalBytes = 0;
    for (const s of selectedSegments) {
      let size = 0;
      try { size = fs.statSync(s.path).size; } catch (e) { size = 0; }
      if (size <= 0) continue;
      if (maxBytes > 0 && totalBytes > 0 && totalBytes + size > maxBytes) break;
      chunks.push(s.path);
      totalBytes += size;
    }

    let success = false;
    if (chunks.length > 0) {
      const listPath = path.join(this.bufferDir, 'concat_list.txt');
      const list = chunks.map(p => `file '${path.resolve(p).replace(/'/g, "'\\''")}'`).join('\n');
      try { fs.writeFileSync(listPath, list); } catch (e) {}

      // Write to a .part file first and rename only on success so an
      // interrupted/failed concat never leaves a broken clip in the clips dir
      const tmpPath = outputFilePath + '.part';
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (e) {}
      }
      success = await runFfmpeg([
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        '-f', 'mp4',
        tmpPath
      ]);
      if (!success) {
        // Fallback: re-encode to produce a guaranteed readable file
        success = await runFfmpeg([
          '-f', 'concat',
          '-safe', '0',
          '-i', listPath,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-tune', 'zerolatency',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          '-f', 'mp4',
          tmpPath
        ]);
      }
      if (success) {
        try { fs.renameSync(tmpPath, outputFilePath); } catch (e) { success = false; }
      }
      if (!success && fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (e) {}
      }
    }

    if (!success) {
      return { success: false, duration: 0, segmentsCount: chunks.length, file: outputFilePath };
    }

    let resultDuration = duration;
    if (chunks.length > 0 && chunks.length < selectedSegments.length) {
      const included = selectedSegments.slice(0, chunks.length);
      resultDuration = Math.min(
        minutes * 60,
        Math.max(1, Math.round((included[included.length - 1].timestamp - included[0].timestamp) / 1000))
      );
    }

    return {
      success,
      duration: resultDuration,
      segmentsCount: chunks.length,
      file: outputFilePath
    };
  }

  getStatus() {
    let totalBytes = 0;
    for (const seg of this.segments) {
      try { totalBytes += fs.statSync(seg.path).size; } catch (e) {}
    }
    return {
      isActive: this.isActive,
      bufferDurationMinutes: this.durationMinutes,
      currentSegmentCount: this.segments.length,
      estimatedMemoryMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100
    };
  }
}
