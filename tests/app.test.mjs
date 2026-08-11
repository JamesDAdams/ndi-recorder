import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { NdiRecorderServer } from '../src/index.mjs';
import { getConfig, updateConfig } from '../src/config.mjs';
import { getApiLogs, getRecordings, getReplaySaves } from '../src/db.mjs';
import { NdiManager } from '../src/ndi.mjs';
import { ReplayBuffer } from '../src/replay-buffer.mjs';
import { FireshareExporter } from '../src/fireshare.mjs';

test('1. Docker & Config Setup: verifies config structures and default settings', () => {
  const config = getConfig();
  assert.strictEqual(config.selectedSource, 'GAMINGPC (NVIDIA GeForce RTX 3070 1)');
  assert.strictEqual(config.video.encoder, 'h264_nvenc');
  assert.strictEqual(config.video.resolution, '1080p');
  assert.strictEqual(config.audio.channels, 'stereo');
});

test('2. NDI Stream Discovery & Auto-Record Trigger', () => {
  const config = getConfig();
  const ndi = new NdiManager(config);

  let detected = false;
  ndi.on('ndiSignalDetected', (source) => {
    detected = true;
    assert.strictEqual(source, 'GAMINGPC_REAL_STREAM');
  });

  ndi.simulateStreamDetection('GAMINGPC_REAL_STREAM', true);
  assert.strictEqual(detected, true);
});

test('3. Replay Buffer Implementation (RAM / tmpfs saving)', async () => {
  const tmpDir = path.join(process.cwd(), 'tmp_test_buffer');
  const buffer = new ReplayBuffer({ bufferDir: tmpDir, durationMinutes: 5 });
  
  buffer.start('GAMINGPC_REAL_STREAM');
  await new Promise(r => setTimeout(r, 2500)); // allow interval to create 1 segment
  
  const status = buffer.getStatus();
  assert.strictEqual(status.isActive, true);
  assert.ok(status.currentSegmentCount > 0);

  const outputPath = path.join(process.cwd(), 'tmp_recordings', 'replay_test.mp4');
  const saveResult = buffer.saveReplay(outputPath, 5);
  assert.strictEqual(saveResult.success, true);
  assert.ok(fs.existsSync(outputPath));

  buffer.stop();

  // Cleanup
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  if (fs.existsSync(path.join(process.cwd(), 'tmp_recordings'))) fs.rmSync(path.join(process.cwd(), 'tmp_recordings'), { recursive: true, force: true });
});

test('4. Stream Deck Remote Integration (REST API endpoints)', async () => {
  const app = new NdiRecorderServer();
  const server = app.listen(0);
  const port = server.address().port;

  // Test /api/status
  const resStatus = await fetch(`http://localhost:${port}/api/status`);
  const statusData = await resStatus.json();
  assert.strictEqual(resStatus.status, 200);
  assert.strictEqual(statusData.isRecording, false);

  // Test Stream Deck Start / Stop with simulated active source
  app.ndiManager.setSource('GAMINGPC_REAL_STREAM');

  const resStart = await fetch(`http://localhost:${port}/api/streamdeck/toggle-rec`, { method: 'POST' });
  const startData = await resStart.json();
  assert.strictEqual(startData.success, true);

  const resStop = await fetch(`http://localhost:${port}/api/streamdeck/toggle-rec`, { method: 'POST' });
  const stopData = await resStop.json();
  assert.strictEqual(stopData.success, true);

  // Test Stream Deck Save 5 min clip
  const resClip = await fetch(`http://localhost:${port}/api/streamdeck/clip-5min`, { method: 'POST' });
  const clipData = await resClip.json();
  assert.strictEqual(clipData.success, true);

  // Test generic clip endpoint with minutes param
  const resClip10 = await fetch(`http://localhost:${port}/api/streamdeck/clip?minutes=10`, { method: 'POST' });
  const clipData10 = await resClip10.json();
  assert.strictEqual(clipData10.success, true);

  // Invalid minutes rejected with 400
  const resClipBad = await fetch(`http://localhost:${port}/api/streamdeck/clip?minutes=99`, { method: 'POST' });
  assert.strictEqual(resClipBad.status, 400);

  app.close();
});

test('5. Fireshare Watch Directory Output Format & Export', () => {
  const config = getConfig();
  const exporter = new FireshareExporter(config);
  const filename = exporter.generateFilename('GAMINGPC_REAL_STREAM', 'TEST', 'clip');
  
  assert.ok(filename.includes('GAMINGPC_REAL_STREAM'));
  assert.ok(filename.includes('TEST'));
  assert.ok(filename.endsWith('.mp4'));

  const outputPath = exporter.getOutputPath(filename);
  assert.ok(outputPath.includes(filename));
});

test('6. Audio Source Routing & Video Quality Configuration', () => {
  const updated = updateConfig({
    video: { resolution: '4K', bitrateMbps: 30, encoder: 'libx264' },
    audio: { channels: 'multichannel', bitrateKbps: 320 }
  });

  assert.strictEqual(updated.video.resolution, '4K');
  assert.strictEqual(updated.video.bitrateMbps, 30);
  assert.strictEqual(updated.video.encoder, 'libx264');
  assert.strictEqual(updated.audio.channels, 'multichannel');
  assert.strictEqual(updated.audio.bitrateKbps, 320);
});

test('7. Project Manifest Validation', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.name.includes('ndi'));
  assert.ok(pkg.description.includes('NDI'));
  assert.ok(pkg.description.includes('Fireshare'));
  assert.ok(pkg.description.includes('Stream Deck'));
});

test('8. Web Dashboard Root HTML Serving (http://localhost:3000)', async () => {
  const app = new NdiRecorderServer();
  const server = app.listen(0);
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/html'));
  
  const htmlText = await res.text();
  assert.ok(htmlText.includes('NDI DockRecorder'));
  assert.ok(htmlText.includes('Replay Buffer'));

  app.close();
});

test('9. Source Profiles & Targeted Auto-Record', () => {
  updateConfig({
    sourceProfiles: {
      'prof-a': { id: 'prof-a', name: 'Profile A', source: 'STREAM_A', autoRecord: true, replayBufferMinutes: 10, bitrateMbps: 20, encoder: 'libx264' },
      'prof-b': { id: 'prof-b', name: 'Profile B', source: 'STREAM_B', autoRecord: false, replayBufferMinutes: 3, bitrateMbps: 8, encoder: 'libx264' }
    }
  });

  const server = new NdiRecorderServer();
  assert.strictEqual(server.config.sourceProfiles['prof-a'].autoRecord, true);
  assert.strictEqual(server.config.sourceProfiles['prof-a'].replayBufferMinutes, 10);
  assert.strictEqual(server.config.sourceProfiles['prof-b'].autoRecord, false);

  server.ndiManager.simulateStreamDetection('STREAM_B', true);
  assert.strictEqual(server.isRecording, false);

  server.ndiManager.simulateStreamDetection('STREAM_A', true);
  assert.strictEqual(server.isRecording, true);
  server.stopRecording();
  server.close();
});

test('10. API Key Protection & Auto-Record Exclusivity per Source', async () => {
  const app = new NdiRecorderServer();
  const server = app.listen(0);
  const port = server.address().port;

  // Verify API Key auth protection
  const resNoAuth = await fetch(`http://localhost:${port}/api/record/start`, { method: 'POST' });
  assert.strictEqual(resNoAuth.status, 401);

  const resAuth = await fetch(`http://localhost:${port}/api/record/start`, {
    method: 'POST',
    headers: { 'X-API-Key': 'ndi_secret_key_12345' }
  });
  assert.strictEqual(resAuth.status, 200);
  await fetch(`http://localhost:${port}/api/record/stop`, {
    method: 'POST',
    headers: { 'X-API-Key': 'ndi_secret_key_12345' }
  });

  // Test Auto-record exclusivity for the same NDI source
  updateConfig({
    sourceProfiles: {
      'prof-1': { id: 'prof-1', name: 'P1', source: 'NDI_CAM_1', autoRecord: true },
      'prof-2': { id: 'prof-2', name: 'P2', source: 'NDI_CAM_1', autoRecord: true }
    }
  });

  const cfg = getConfig();
  // prof-1 autoRecord should be set to false because prof-2 activated autoRecord on NDI_CAM_1
  assert.strictEqual(cfg.sourceProfiles['prof-1'].autoRecord, false);
  assert.strictEqual(cfg.sourceProfiles['prof-2'].autoRecord, true);

  app.close();
});

test('11. Multi-Page Navigation Routes & HTML Elements', async () => {
  const app = new NdiRecorderServer();
  const server = app.listen(0);
  const port = server.address().port;

  for (const pathStr of ['/', '/settings', '/api-docs']) {
    const res = await fetch(`http://localhost:${port}${pathStr}`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('id="page-dashboard"'));
    assert.ok(html.includes('id="page-settings"'));
    assert.ok(html.includes('id="page-apidocs"'));
    assert.ok(html.includes('switchPage('));
  }

  app.close();
});

test('12. Page Switching Script & Navigation Button Event Attributes', async () => {
  const m = await import('../src/html.mjs');
  const html = m.getDashboardHtml();
  assert.ok(html.includes('onclick="switchPage(\'dashboard\')"'));
  assert.ok(html.includes('onclick="switchPage(\'settings\')"'));
  assert.ok(html.includes('onclick="switchPage(\'apidocs\')"'));
  assert.ok(html.includes('type="button" id="nav-btn-dashboard"'));
  assert.ok(html.includes('type="button" id="nav-btn-settings"'));
  assert.ok(html.includes('type="button" id="nav-btn-apidocs"'));
  assert.ok(html.includes('window.switchPage = switchPage'));
  assert.ok(html.includes('el.style.display = p === \'dashboard\' ? \'grid\' : \'block\''));
});

test('13. Settings persistence via SQLite (round-trip)', async () => {
  const fresh = await import('../src/config.mjs?fresh=' + Date.now());
  fresh.updateConfig({ video: { resolution: '720p' }, replayBufferMinutes: 7 });

  const reloaded = await import('../src/config.mjs?reload=' + Date.now());
  assert.strictEqual(reloaded.getConfig().video.resolution, '720p');
  assert.strictEqual(reloaded.getConfig().replayBufferMinutes, 7);
});

test('14. SQLite logs: api_logs, recordings & replay_saves', async () => {
  const app = new NdiRecorderServer();
  const server = app.listen(0);
  const port = server.address().port;

  app.ndiManager.setSource('GAMINGPC_REAL_STREAM');

  await fetch(`http://localhost:${port}/api/streamdeck/toggle-rec`, { method: 'POST' });
  await fetch(`http://localhost:${port}/api/streamdeck/toggle-rec`, { method: 'POST' });
  await fetch(`http://localhost:${port}/api/streamdeck/clip-5min`, { method: 'POST' });

  const logs = getApiLogs();
  assert.ok(logs.some(l => l.path === '/api/streamdeck/toggle-rec'));
  assert.ok(logs.some(l => l.path === '/api/streamdeck/clip-5min'));
  assert.ok(logs.every(l => !l.query || !l.query.includes('ndi_secret_key_12345')));

  const recs = getRecordings();
  const rec = recs.find(r => r.source === 'GAMINGPC_REAL_STREAM' && r.type === 'full');
  assert.ok(rec);
  assert.strictEqual(rec.size_bytes, 'FULL_RECORDING_MP4_DATA'.length);

  const replays = getReplaySaves();
  const replay = replays.find(r => r.minutes === 5 && r.source === 'GAMINGPC_REAL_STREAM');
  assert.ok(replay);

  app.close();
});

test('15. Profile form not clobbered by fetchStatus polling (dirty flag)', async () => {
  const m = await import('../src/html.mjs');
  const html = m.getDashboardHtml();
  assert.ok(html.includes('let profileFormDirty = false;'));
  assert.ok(html.includes("if (profileFormDirty) return;"));
  assert.ok(html.includes("if (res.ok) profileFormDirty = false;"));
  assert.ok(html.includes("'prof-auto-record'"));
  assert.ok(html.includes("profileFormDirty = true;"));
});

test('16. NDI signal detection: no frames => hasSignal false & dashboard badge offline', async () => {
  const app = new NdiRecorderServer();
  const server = app.listen(0);
  const port = server.address().port;

  let lostSource = null;
  app.ndiManager.on('ndiSignalLost', (s) => { lostSource = s; });

  assert.strictEqual(app.previewStream.hasSignal, false);

  // Simulate a pipeline that once received frames, then went silent > 5s
  app.previewStream.hasSignal = true;
  app.previewStream.lastFrameAt = Date.now() - 10000;

  const deadline = Date.now() + 5000;
  while (app.previewStream.hasSignal && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
  }

  assert.strictEqual(app.previewStream.hasSignal, false);
  assert.strictEqual(lostSource, app.config.selectedSource);

  const res = await fetch(`http://localhost:${port}/api/status`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.isStreamActive, false);

  const m = await import('../src/html.mjs');
  const html = m.getDashboardHtml();
  assert.ok(html.includes('id="badge-live-label"'));
  assert.ok(html.includes('HORS LIGNE'));

  app.close();
  server.close();
});

test('17. Per-Profile Output Directories (recordDir / clipDir)', () => {
  updateConfig({
    sourceProfiles: {
      'prof-a': {
        id: 'prof-a',
        name: 'Profile A',
        source: 'STREAM_A',
        autoRecord: true,
        replayBufferMinutes: 10,
        bitrateMbps: 20,
        encoder: 'libx264',
        recordDir: './tmp_recordings/full',
        clipDir: './tmp_recordings/clips'
      },
      'prof-b': {
        id: 'prof-b',
        name: 'Profile B',
        source: 'STREAM_B',
        autoRecord: false,
        replayBufferMinutes: 3,
        bitrateMbps: 8,
        encoder: 'libx264'
      }
    }
  });

  const exporter = new FireshareExporter(getConfig());
  const filename = 'test_profile_dirs.mp4';

  const fullPath = exporter.getOutputPath(filename, 'STREAM_A', 'full');
  assert.ok(fullPath.includes('tmp_recordings/full'));
  assert.ok(fullPath.includes(filename));

  const clipPath = exporter.getOutputPath(filename, 'STREAM_A', 'clip');
  assert.ok(clipPath.includes('tmp_recordings/clips'));
  assert.ok(clipPath.includes(filename));

  const fallbackPath = exporter.getOutputPath(filename, 'STREAM_B', 'full');
  assert.ok(fallbackPath.includes(path.join(getConfig().recordingDir || './recordings', filename)));

  const fallbackClipPath = exporter.getOutputPath(filename, 'STREAM_B', 'clip');
  assert.ok(fallbackClipPath.includes(path.join(getConfig().recordingDir || './recordings', filename)));

  const profB = getConfig().sourceProfiles['prof-b'];
  assert.strictEqual(profB.recordDir, '');
  assert.strictEqual(profB.clipDir, '');

  fs.rmSync('./tmp_recordings/full', { recursive: true, force: true });
  fs.rmSync('./tmp_recordings/clips', { recursive: true, force: true });
});

test('18. Preview enable/disable toggle (dashboard button + API)', async () => {
  updateConfig({ previewEnabled: true });
  const app = new NdiRecorderServer();
  const server = app.listen(0);
  const port = server.address().port;

  const html = await (await fetch(`http://localhost:${port}/`)).text();
  assert.ok(html.includes('btn-toggle-preview'));
  assert.ok(html.includes('togglePreview('));

  const resDisable = await fetch(`http://localhost:${port}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ previewEnabled: false })
  });
  assert.strictEqual(resDisable.status, 200);
  const cfg = await resDisable.json();
  assert.strictEqual(cfg.config.previewEnabled, false);
  assert.strictEqual(app.previewStream.enabled, false);

  const status = await (await fetch(`http://localhost:${port}/api/status`)).json();
  assert.strictEqual(status.config.previewEnabled, false);

  const resMjpeg = await fetch(`http://localhost:${port}/api/preview.mjpeg`);
  assert.strictEqual(resMjpeg.status, 404);
  const resJpg = await fetch(`http://localhost:${port}/api/preview.jpg`);
  assert.strictEqual(resJpg.status, 404);

  const resEnable = await fetch(`http://localhost:${port}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ previewEnabled: true })
  });
  assert.strictEqual(resEnable.status, 200);
  const cfgOn = await resEnable.json();
  assert.strictEqual(cfgOn.config.previewEnabled, true);
  assert.strictEqual(app.previewStream.enabled, true);

  const resMjpegOn = await fetch(`http://localhost:${port}/api/preview.mjpeg`, { method: 'HEAD' });
  assert.strictEqual(resMjpegOn.status, 200);

  updateConfig({ previewEnabled: false });
  const app2 = new NdiRecorderServer();
  assert.strictEqual(app2.config.previewEnabled, false);
  app2.close();

  updateConfig({ previewEnabled: true });
  app.close();
});

test.after(() => {
  // Ensure process exits cleanly after node test suite finishes
  setImmediate(() => {
    process.exit(0);
  });
});


