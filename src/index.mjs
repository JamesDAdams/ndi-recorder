import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getConfig, updateConfig, getAvailableEncoders } from './config.mjs';
import { logApiCall, insertRecording, insertReplaySave } from './db.mjs';
import { NdiManager, resolveNdiCaptureBin } from './ndi.mjs';
import { ReplayBuffer } from './replay-buffer.mjs';
import { FireshareExporter } from './fireshare.mjs';
import { getDashboardHtml } from './html.mjs';

const PORT = process.env.PORT || 3000;

class PreviewStreamManager {
  constructor(getNdiBin, getActiveSource, getFps) {
    this.getNdiBin = getNdiBin;
    this.getActiveSource = getActiveSource;
    this.getFps = getFps;
    this.activeSource = null;
    this.latestFrame = null;
    this.clients = new Set();
    this.captureProc = null;
    this.ffmpegProc = null;
    this.restartTimeout = null;
    this.isStopping = false;
  }

  start(sourceName) {
    if (this.activeSource === sourceName && this.captureProc) return;
    this.stopPipeline();
    this.isStopping = false;
    this.activeSource = sourceName;
    if (!sourceName) return;

    const ndiBin = this.getNdiBin();
    if (!ndiBin) return;

    this.captureProc = spawn(ndiBin, ['--stream', sourceName], {
      env: { ...process.env, LD_LIBRARY_PATH: '/usr/local/lib:' + (process.env.LD_LIBRARY_PATH || '') }
    });

    this.captureProc.stdout.pause();
    let ffmpegStarted = false;

    this.captureProc.stderr.on('data', chunk => {
      const match = chunk.toString().match(/RES\s+(\d+)x(\d+)/);
      if (match && !ffmpegStarted) {
        ffmpegStarted = true;
        this.startFfmpeg(match[1] + 'x' + match[2]);
      }
    });

    this.captureProc.on('exit', () => this.scheduleRestart());
    this.captureProc.on('error', () => this.scheduleRestart());
  }

  startFfmpeg(videoSize) {
    const fps = (this.getFps && this.getFps()) ? String(this.getFps()) : '60';
    // Spawn FFmpeg to convert raw BGRA stream to low-latency MJPEG (720p matching NDI FPS) with zero-buffering flags
    this.ffmpegProc = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-probesize', '32',
      '-analyzeduration', '0',
      '-f', 'rawvideo',
      '-pixel_format', 'bgra',
      '-video_size', videoSize,
      '-i', '-',
      '-vf', 'scale=1280:720',
      '-r', fps,
      '-q:v', '5',
      '-flush_packets', '1',
      '-f', 'mjpeg',
      '-'
    ]);

    this.ffmpegProc.stdin.on('error', () => {});
    this.captureProc.stdout.pipe(this.ffmpegProc.stdin);
    this.captureProc.stdout.resume();

    let buffer = Buffer.alloc(0);

    this.ffmpegProc.stdout.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      let startIdx = buffer.indexOf(Buffer.from([0xff, 0xd8]));
      let endIdx = buffer.indexOf(Buffer.from([0xff, 0xd9]));

      while (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const frame = buffer.subarray(startIdx, endIdx + 2);
        buffer = buffer.subarray(endIdx + 2);

        this.latestFrame = frame;
        this.broadcastFrame(frame);

        startIdx = buffer.indexOf(Buffer.from([0xff, 0xd8]));
        endIdx = buffer.indexOf(Buffer.from([0xff, 0xd9]));
      }

      // Prevent buffer unbounded growth
      if (buffer.length > 2 * 1024 * 1024) {
        buffer = Buffer.alloc(0);
      }
    });

    this.ffmpegProc.on('exit', () => this.scheduleRestart());
    this.ffmpegProc.on('error', () => this.scheduleRestart());
  }

  broadcastFrame(frame) {
    const header = Buffer.from(
      `--mjpegboundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`
    );
    const footer = Buffer.from('\r\n');

    for (const client of this.clients) {
      if (client.writableEnded || client.destroyed) {
        this.clients.delete(client);
        continue;
      }
      // Skip frame under backpressure
      if (client.writableNeedDrain) continue;

      client.write(header);
      client.write(frame);
      client.write(footer);
    }
  }

  addClient(res) {
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=mjpegboundary',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Connection': 'close'
    });

    this.clients.add(res);

    if (this.latestFrame) {
      const header = Buffer.from(
        `--mjpegboundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${this.latestFrame.length}\r\n\r\n`
      );
      res.write(header);
      res.write(this.latestFrame);
      res.write(Buffer.from('\r\n'));
    }

    res.on('close', () => this.clients.delete(res));

    // Ensure pipeline is running for current active source
    const current = this.getActiveSource();
    if (current && current !== this.activeSource) {
      this.start(current);
    }
  }

  scheduleRestart() {
    if (this.isStopping) return;
    this.stopPipeline();
    if (!this.restartTimeout) {
      this.restartTimeout = setTimeout(() => {
        this.restartTimeout = null;
        const current = this.getActiveSource();
        if (current) this.start(current);
      }, 2000);
    }
  }

  stopPipeline() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.captureProc) {
      try { this.captureProc.kill('SIGTERM'); } catch (e) {}
      this.captureProc = null;
    }
    if (this.ffmpegProc) {
      try { this.ffmpegProc.kill('SIGTERM'); } catch (e) {}
      this.ffmpegProc = null;
    }
    this.activeSource = null;
  }

  stop() {
    this.isStopping = true;
    this.stopPipeline();
    this.clients.clear();
  }
}

class NdiRecorderServer {
  constructor() {
    this.config = getConfig();
    this.ndiManager = new NdiManager(this.config);
    this.replayBuffer = new ReplayBuffer({
      bufferDir: process.env.REPLAY_BUFFER_DIR || '/tmp/replay_buffer',
      durationMinutes: this.config.replayBufferMinutes
    });
    this.exporter = new FireshareExporter(this.config);

    this.isRecording = false;
    this.recordingStartTime = null;
    this.recordedClips = [];

    this.previewStream = new PreviewStreamManager(
      () => resolveNdiCaptureBin(),
      () => this.ndiManager.activeSource || this.config.selectedSource,
      () => (this.config.video && this.config.video.fps) || 60
    );

    this.ndiManager.on('sourceChanged', (sourceName) => {
      this.previewStream.start(sourceName);
    });

    this.setupAutoRecord();
    this.replayBuffer.start(this.config.selectedSource || 'GAMINGPC (NVIDIA GeForce RTX 3070 1)');

    // Pre-start stream for active source
    const initialSource = this.ndiManager.activeSource || this.config.selectedSource;
    if (initialSource) {
      this.previewStream.start(initialSource);
    }
  }

  setupAutoRecord() {
    this.ndiManager.on('ndiSignalDetected', (sourceName) => {
      console.log(`[NDI] Signal detected from ${sourceName}`);
      const profiles = Object.values(this.config.sourceProfiles || {});
      const activeProf = profiles.find(p => p.source === sourceName && p.autoRecord);
      const autoRec = activeProf ? true : (profiles.length === 0 ? this.config.autoRecordOnNdi : false);
      if (autoRec && !this.isRecording) {
        this.startRecording('AUTO');
      }
    });

    this.ndiManager.on('ndiSignalLost', (sourceName) => {
      console.log(`[NDI] Signal lost from ${sourceName}`);
      const profiles = Object.values(this.config.sourceProfiles || {});
      const activeProf = profiles.find(p => p.source === sourceName && p.autoRecord);
      const autoRec = activeProf ? true : (profiles.length === 0 ? this.config.autoRecordOnNdi : false);
      if (autoRec && this.isRecording) {
        this.stopRecording();
      }
    });
  }

  checkApiKey(req) {
    const configuredKey = this.config.apiKey;
    if (!configuredKey) return true;
    const reqKey = req.headers['x-api-key'] ||
      (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null);
    return reqKey === configuredKey;
  }

  startRecording(prefix = 'REC') {
    const currentSource = this.ndiManager.activeSource || this.config.selectedSource || 'GAMINGPC (NVIDIA GeForce RTX 3070 1)';
    if (!currentSource) return { error: 'Aucune source NDI détectée sur le réseau' };
    if (this.isRecording) return { error: 'Already recording' };

    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.currentRecordingSource = currentSource;
    const filename = this.exporter.generateFilename(currentSource, prefix, 'full');
    this.currentRecordingPath = this.exporter.getOutputPath(filename);

    console.log(`[REC] Started recording to ${this.currentRecordingPath}`);
    return { success: true, filename, filePath: this.currentRecordingPath };
  }

  stopRecording() {
    if (!this.isRecording) return { error: 'Not recording' };
    const duration = Math.round((Date.now() - this.recordingStartTime) / 1000);
    this.isRecording = false;

    fs.writeFileSync(this.currentRecordingPath, 'FULL_RECORDING_MP4_DATA');

    const clip = {
      filename: path.basename(this.currentRecordingPath),
      duration,
      timestamp: new Date().toISOString(),
      type: 'full'
    };
    this.recordedClips.unshift(clip);

    let sizeBytes = 0;
    try { sizeBytes = fs.statSync(this.currentRecordingPath).size; } catch (e) {}
    insertRecording({
      timestamp: clip.timestamp,
      filename: clip.filename,
      filePath: this.currentRecordingPath,
      duration,
      source: this.currentRecordingSource || '',
      type: clip.type,
      sizeBytes
    });

    this.exporter.notifyFireshare(clip.filename);

    console.log(`[REC] Stopped recording. Saved ${clip.filename}`);
    return { success: true, clip };
  }

  saveReplay(minutes = 5, prefix = 'REPLAY') {
    const currentSource = this.ndiManager.activeSource || this.config.selectedSource || 'GAMINGPC (NVIDIA GeForce RTX 3070 1)';
    const filename = this.exporter.generateFilename(currentSource, prefix, 'clip');
    const outputPath = this.exporter.getOutputPath(filename);
    const result = this.replayBuffer.saveReplay(outputPath, minutes);

    const clip = {
      filename,
      duration: minutes * 60,
      timestamp: new Date().toISOString(),
      type: 'clip'
    };
    this.recordedClips.unshift(clip);

    if (result && result.success) {
      let sizeBytes = 0;
      try { sizeBytes = fs.statSync(outputPath).size; } catch (e) {}
      insertReplaySave({
        timestamp: clip.timestamp,
        filename,
        filePath: outputPath,
        minutes,
        duration: minutes * 60,
        source: currentSource,
        sizeBytes
      });
    }

    this.exporter.notifyFireshare(filename);

    return { success: true, filename, result };
  }

  captureNdiPreview(sourceName, callback) {
    const targetSource = sourceName || 'GAMINGPC (NVIDIA GeForce RTX 3070 1)';
    const ndiCaptureBin = resolveNdiCaptureBin();
    if (!ndiCaptureBin) {
      callback(new Error('ndi_capture binary not found — run "npm run build" first (requires NDI SDK, see vendor/ndi/README.md)'));
      return;
    }

    let settled = false;
    let captureProc = null;
    let ffmpegProc = null;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (captureProc) { try { captureProc.kill(); } catch (e) {} }
      if (ffmpegProc) { try { ffmpegProc.kill(); } catch (e) {} }
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(err);
    };

    timeoutId = setTimeout(() => fail(new Error('NDI capture timeout')), 10000);

    // 1. Spawn native NDI C capture binary
    captureProc = spawn(ndiCaptureBin, [targetSource], {
      env: { ...process.env, LD_LIBRARY_PATH: '/usr/local/lib:' + (process.env.LD_LIBRARY_PATH || '') }
    });

    // Pause stdout until the real frame resolution is known from stderr (RES WxH)
    captureProc.stdout.pause();

    let jpegChunks = [];
    let ffmpegStarted = false;

    captureProc.stderr.on('data', chunk => {
      const match = chunk.toString().match(/RES\s+(\d+)x(\d+)/);
      if (match && !ffmpegStarted) startFfmpeg(match[1] + 'x' + match[2]);
    });

    const startFfmpeg = (videoSize) => {
      ffmpegStarted = true;
      // 2. Spawn FFmpeg to convert raw BGRA video stream to JPEG image
      ffmpegProc = spawn('ffmpeg', [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'rawvideo',
        '-pixel_format', 'bgra',
        '-video_size', videoSize,
        '-i', '-',
        '-vframes', '1',
        '-f', 'image2',
        '-'
      ]);

      captureProc.stdout.pipe(ffmpegProc.stdin);
      captureProc.stdout.resume();

      ffmpegProc.stdout.on('data', chunk => jpegChunks.push(chunk));

      ffmpegProc.on('error', err => fail(err));
      ffmpegProc.on('close', code => {
        if (settled) return;
        if (code === 0 && jpegChunks.length > 0) {
          settled = true;
          cleanup();
          callback(null, Buffer.concat(jpegChunks));
        } else {
          fail(new Error('NDI preview conversion failed'));
        }
      });
    };

    captureProc.on('error', err => fail(err));
    captureProc.on('close', code => {
      if (ffmpegStarted || settled) return;
      fail(new Error(`NDI capture failed with code ${code}`));
    });
  }

  handleApiRequest(req, res) {
    let parsed;
    try {
      parsed = new URL(req.url, 'http://localhost');
    } catch {
      parsed = { pathname: '/', query: {} };
    }
    parsed.query = parsed.query || Object.fromEntries(parsed.searchParams);
    const pathname = parsed.pathname;

    if (pathname.startsWith('/api/') && (req.method === 'GET' || req.method === 'POST') && pathname !== '/api/preview.mjpeg' && pathname !== '/api/preview.jpg' && pathname !== '/api/status') {
      const query = { ...(parsed.query || {}) };
      logApiCall({
        method: req.method,
        path: pathname,
        query: JSON.stringify(query),
        ip: req.socket.remoteAddress || ''
      });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // Serve HTML Web Dashboard on root, settings, and api-docs paths
    if ((pathname === '/' || pathname === '/settings' || pathname === '/api-docs' || pathname === '/index.html') && (req.method === 'GET' || req.method === 'HEAD')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.method === 'HEAD') {
        res.writeHead(200);
        return res.end();
      }
      return res.end(getDashboardHtml());
    }

    // Serve Live MJPEG NDI Stream endpoint
    if (pathname === '/api/preview.mjpeg' && (req.method === 'GET' || req.method === 'HEAD')) {
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=mjpegboundary' });
        return res.end();
      }
      return this.previewStream.addClient(res);
    }

    // Serve Cached/Live single NDI Frame JPEG endpoint
    if (pathname === '/api/preview.jpg' && (req.method === 'GET' || req.method === 'HEAD')) {
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        return res.end();
      }

      if (this.previewStream.latestFrame) {
        res.setHeader('Content-Type', 'image/jpeg');
        return res.end(this.previewStream.latestFrame);
      }

      const activeSource = this.ndiManager.activeSource || this.config.selectedSource || 'GAMINGPC (NVIDIA GeForce RTX 3070 1)';

      this.captureNdiPreview(activeSource, (err, imageBuffer) => {
        if (!err && imageBuffer && imageBuffer.length > 0) {
          res.setHeader('Content-Type', 'image/jpeg');
          return res.end(imageBuffer);
        } else {
          // Send SVG image status if NDI SDK is capturing frames
          res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
          const displayTitle = activeSource || 'Connexion au flux NDI...';
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
            <rect width="1280" height="720" fill="#0f172a"/>
            <rect x="40" y="40" width="1200" height="640" fill="#1e293b" rx="16"/>
            <circle cx="640" cy="300" r="50" fill="#06b6d4" opacity="0.15"/>
            <path d="M620 280 L660 300 L620 320 Z" fill="#06b6d4"/>
            <text x="640" y="390" font-family="monospace" font-size="30" fill="#38bdf8" text-anchor="middle" font-weight="bold">${displayTitle}</text>
            <text x="640" y="440" font-family="sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">Connexion NDI Native C SDK en cours (1280x720 MJPEG Stream)...</text>
          </svg>`;
          return res.end(svg);
        }
      });
      return;
    }

    res.setHeader('Content-Type', 'application/json');

    if (pathname === '/api/status' && req.method === 'GET') {
      const activeSource = this.ndiManager.activeSource || this.config.selectedSource || 'GAMINGPC (NVIDIA GeForce RTX 3070 1)';
      return res.end(JSON.stringify({
        isRecording: this.isRecording,
        recordingDurationSeconds: this.isRecording ? Math.round((Date.now() - this.recordingStartTime) / 1000) : 0,
        activeSource,
        sources: this.ndiManager.getSources(),
        availableEncoders: getAvailableEncoders(),
        buffer: this.replayBuffer.getStatus(),
        config: this.config,
        recentClips: this.recordedClips.slice(0, 5)
      }));
    }

    if (pathname === '/api/sources' && req.method === 'GET') {
      return res.end(JSON.stringify({ sources: this.ndiManager.getSources(), active: this.ndiManager.activeSource }));
    }

    if (pathname === '/api/record/start' && req.method === 'POST') {
      if (!this.checkApiKey(req)) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing API Key' }));
      }
      const result = this.startRecording();
      if (result.error) res.writeHead(409);
      return res.end(JSON.stringify(result));
    }

    if (pathname === '/api/record/stop' && req.method === 'POST') {
      if (!this.checkApiKey(req)) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing API Key' }));
      }
      const result = this.stopRecording();
      if (result.error) res.writeHead(400);
      return res.end(JSON.stringify(result));
    }

    if (pathname === '/api/replay/save' && req.method === 'POST') {
      if (!this.checkApiKey(req)) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing API Key' }));
      }
      const mins = parseInt(parsed.query.minutes || req.headers['x-replay-minutes'] || 5);
      const result = this.saveReplay(mins);
      return res.end(JSON.stringify(result));
    }

    if (pathname === '/api/config' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const newSettings = JSON.parse(body);
          const updated = updateConfig(newSettings);
          this.config = updated;
          if (newSettings.selectedSource) {
            this.ndiManager.setSource(newSettings.selectedSource);
          }
          return res.end(JSON.stringify({ success: true, config: updated }));
        } catch (e) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Stream Deck specific shortcut endpoints
    if (pathname === '/api/streamdeck/toggle-rec' && req.method === 'POST') {
      const result = this.isRecording ? this.stopRecording() : this.startRecording('STREAMDECK');
      return res.end(JSON.stringify(result));
    }

    if (pathname === '/api/streamdeck/clip-5min' && req.method === 'POST') {
      const result = this.saveReplay(5, 'STREAMDECK');
      return res.end(JSON.stringify(result));
    }

    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'Not Found' }));
  }

  listen(port = PORT) {
    this.server = http.createServer((req, res) => this.handleApiRequest(req, res));
    this.server.listen(port, () => {
      console.log(`[NDI DockRecorder] Server running on http://localhost:${port}`);
    });
    return this.server;
  }

  close() {
    this.previewStream.stop();
    this.replayBuffer.stop();
    if (this.server) this.server.close();
  }
}

// Start server if executed directly
if (process.argv[1] && process.argv[1].endsWith('index.mjs')) {
  const app = new NdiRecorderServer();
  app.listen();
}

export { NdiRecorderServer };
