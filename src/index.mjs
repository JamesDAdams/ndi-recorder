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

const PLACEHOLDER_JPEG_BASE64 = '/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjExLjEwMAD/2wBDAAgGBgcGBwgICAgICAkJCQoKCgkJCQkKCgoKCgoMDAwKCgoKCgoKDAwMDA0ODQ0NDA0ODg8PDxISEREVFRUZGR//xAB8AAEAAwEBAQEAAAAAAAAAAAAABQQGAwIBBwEBAQEBAAAAAAAAAAAAAAAAAAEDBBABAAIBAwMCBAQDBQkBAQAAAAECAwQRBRIhEzEGQVEiFGEyFXGBIzNyQrSCNpGUkrEmYtE0FlJDEQEBAQAAAAAAAAAAAAAAAAAAEdH/wAARCAFoAoADASIAAhEAAxEA/9oADAMBAAIRAxEAPwD8WAdbEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABLe2ePwcpzGk0moi04ss5ItFbdM/TivaNp/eIBEjS5NT7Ux3tT9N5Gem01/8Abr8J2+SGpx+o1vmy6PTZsmGmWKxFYm9q+S0+Ok7d5tPp2juCmLuu4jkONiltXpM+ni/5bZKTETPy39N/w9VIASWl9v8AL63FGbT6DU5cVu9b1xz02iO30zO3V3+W71xXC6jkOUxcffHmxWnJEZo6NsmKm8dd5rbbbpid+4IsaHJ7R5PHyFNNbTZ4wZdXODHmmtfrpE2nriN9v6VLZP2hw5z21ruHy57WwZvtMeWcePUXiIi8b/TPaf7wVCiRwcDy2qwfcYdBqsmLbeL1xWmLR869t7R/Z3VtPotTq5y1wYb5Jw4r5skVjvTHj26rTHyjeNwVxf1PCcpo8EajUaLU4cM7fzL4rViN/Tq3j6d/h1bJPS+0tbrOGpr8GHPlzX1XjphrWu1tP49/PE77/wBT6AZ0W6cZrsuqvo8emzZNRSbVthpSbXrNZ2t1RXfaIn1n0Ndxmu421a6vTZtPNo3r5KTEW29emfSdvjtPYFQEhpuC5XWYfPp9Dqc2LvtemK0xbb16e31f5dwR4nfduiw6Lmcun02GMVIx6fbHSJ/NbDSZ7eu82lTz8Dy2lwfcZtBqseGI3m9sVoisfO3besf2tgRwLmh4nkOT6vtNLn1EV/NOOkzWs/Kbflifw33BTEnpuMz4OSwaXW6HVTN7d9NETiy5KzE7eObRt6x6+naVX7TLqNZfT6bBmtecl60wRE3yREWn6Z6d95rHrP4ArCS1Pt/ltHjyZc+h1GLHirFr3vSYrEWnpj6vSe/baO8Oen4fktVTDfBpM+auebxjnHSbdXjna/pvtFZ9ZnaAURY1mg1fHZfFqsGXT5Nt4rkrNZmPnG/aY/GOy7X21zd8Xlrxurmm3VE+G28x67xXbqn+EAihO+1dFg1fIZcWpxRkrXSaq3ReJ7XpjmYnbt3rKCAGr9tcHxnJ6DPk1lsmPLfVV0mDLW+1KZMuKZxzevxib7R/FR4Thaajls2g11L1nDi1PXWtumYyYaWmO/y3j+MAghouA0HGZeO5XXchizZq6KdL00w5PHM+fJak99tvXaf4O+m4727ztvttBfWaDW2ifDTVWx5MGa0Rv4+usddbT8Jnt8omQrLDR+1uN4/WcpbjeS0+ec172pSaZOiMVsNMtssZI7779MRG3psh+TnRzqsn2WLLhwRtFaZb9d94ja0zaPnPeAVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGg9kf6j4/+1l/w+Rn1rjuQz8Xq8Wr081jLim01m1eqPqrNZ3j9pkE5n95cjXLkrGHjtovaO+iw79pn8HbidfqcPt/n9ThyWwZr6jSb3xfRMeXJfqim35e0zEbekK3/wBpyc//AMeO/wByw/8AhFfqup+31mmjxxj1uWmXNEUiPqpabV6P/wAxvPpAia0uqz6v2ry9dRlyZvDqtHfH5LWvNJyXmtumbTMxvH/OWXW8PI6jBo9ToqTXw6m2K2SJrvbfFO9dp+Hf1VBWzyfY8Hp9Bi5DWczqM19Ljz48GjzRh0+DHl3mtYmZ3m2++81+K3yeT/q7gstPJj82Dj7W67T5J67zG2We3VbaIi2/rszum928xpdNj01M2Oa4a9OG+TBiyZcVfhWl71mYiPhvvt8FPXczruR1ODVZsu+fBTHSmWva38qZtW8z8b7zvNvmJEjl1Wpj3NNLZs21OXmIrOS+1Y+5mu0Rv2+mZj9p2e+byWy+5s+n1OXJ9tPJVi9LXt0RjnLG89MztEdM7wo8l7j5HlseOmpthmaXrk8uPDjx5ZvWJiJtkpET6T6dofeR9ycjyunjBqrYcneszk8GKuW3R6dWStYsDW85q+P0/L5Zzcxy+ky4L1imDFg6cOKlYjprjrForNJj8NrfFW0HIYcvOe5Ndx83xVnhtVnxWmnRaMnRgtN+mfnl3tHz9UFg948zgxUxTlxZ4xxtjtqMGLLkpEem17V6p2/7t1OvO6+NRrdTbJW+bXafJps97Ur9WLLFYtERWK1rO1YiJiOwRM+29dq9Zj57FqNRmz0tw2szTXLkvePLj6Om/wBUz9UdU93jFqNRT2bM48uWs05uK71vaJrSdH6bxPavVPp6boLQ8jqOO+58E1j7nTZdLk6q7/ys23VEfKe0bSscXz+v4euXHpr0nFl2m+LLjplx2tHpbpvE7T+3r8QaP2/fTU9ua/UZtXq9Lkya+uPUanS08mfxeKLUre2/VWlrzbe2/efp+KtyXJcVfhM+iw67X6/JGfFmwzqsU/yZiem/TfedotWZ7em/7oXSc/yOh1efVafNGK+omZy0rjp4r7zM7Thms49o3nbt237OnI+5eS5PB9tmthpgm0WnFhwYsVbWr6WtNa9U7fvsERWOKzekWnas2iLT8o37z/sar3jrdfpubvpcGbPgwYKYKaTFgvelIx+Km044pMbzNt43jv22+DJp3F7w5rDp6YK6ik+OvRjy2w4rZsdNtummW1ZtHbtE+sfMVqppjye+pnN3vTSVyY4mvVPmro6zExWfzWr3tEfOFXQ8tw+j105svL8xq5v1482mz4LTTLF4ms0vSbfCZ7REdpjZkdZzGt1uu+/yZenUx49smP6JicdYrWY2+O0JOfe/N7f1cEZdtvPGl0/m/wCLo2/jsJGfv09Vunfp3nbf1237btLxvMaGeJxcbrMvIaHozZMuPU6PbpydfafPTqra3TPaJrM+jMJnj/c/J8bpq6XFbDfBSbTTHmwYssUm07zNZtXq7z37zIqc02jz6X3HwWS+vvyODPFL6bPk8kX8O9/otXJNrV2mZ7b7d3Pj75NLofdOr0szXV0zY8cZKf1MWDJqb+S1JjvG8R3mPTp3+CBvz/I5eQxcjkzeTUYZjxzateikV32rXHWIrFY3ntELntzX2xcjqM9uTrxtsuO8+S+Cc2HLe14mcWTHHaKzE2mLT6bdhFviNVq9R7f9xebNny0ri0nT5Ml71i05/q6eqZiJmNt9vwfdVrtVpPanD0wZ8uGuXPrfJ47zTrimXtEzXado3ntvsuc1z2OnFavR/qWHkM2rnFWtNLpvBptNjx367WjtHXfJMRE+sxDJ5uR1GfR6bRXmvh01stscRXa2+Wd7bz8e/oGp/lJzcjwHt6cl5yZ759XgrkyWmbbTlpFYtad52jtHf0hKW1PH8TymLSZtXzuu12LJix2vTPGLBF/p2pTHvN5pG/eveJj8GMy8lqMuj02jtNfFpb5L4to2tFss723t6z3jt8krPvTnJpWPuKddYivnjDi89qx8LZenr/eYmJn5hE7p61p7y5eKxER4NbPb52wbzP8AGZ3YJJ157XV5DPyEWx/cZ63rknojp2yV6bbV+HZGCtHpJmvtPXTEzExyenmJj1ifHPeGl4iI5jNp+cxxHl+z1Ok5CI+Gox6efHmmPllptvPpExEMFTkdRTQ5dBE18GXNXNaOn6uukbRtb5bfB34rnNdw0aiNLeta6inRkrasWrMRvtO3wtG8xE/iJEnw/wDpn3J+/G/4mVP2totRreY0XhrbbDqMWfLk/u48eK8Xta1vSO0bRv6z2cuJ5/W8NTPTTRhmmo8fkrmxVyRPj6untbt26pdtb7r5fXYLaa2amHBb82LT4seGtvwtNKxaYn4xvtPxBMcHqcWs98xnxd8eTVay1Jj+9WcOba3+b1/iyV62vnvWsTa03tEVrEzMzv6REd17h+e1nB2yW0kYerJ072yYq5LV6eqPome9d4tO+3q85Oa1WTkqclthpqMdqXr0Yq1x9WPbb6I7fDv8wUfFk6/H0X8m/T0dM9XV8un13/A8WTr8fRfyb9PR0z1dXy6fXf8ABb/VtV+pfqW9PufP59+n6fJvv+X5b/A/VtV+pfqW9PufP59+n6fJvv8Al+W/wFUrVtS01tE1tE7TW0TExPymJ7vjvrNXl12pzanNtOTNe2S/TG0dVp3naPg4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//Z';

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
    this.hasSignal = false;
    this.lastFrameAt = 0;
    this.restartDelay = 2000;
    this.onSignalChange = null;
    this.lastNotified = null;
    this.placeholderInterval = null;

    this.signalWatchInterval = setInterval(() => {
      if (!this.hasSignal) return;
      if (this.lastFrameAt && Date.now() - this.lastFrameAt > 5000) {
        this.hasSignal = false;
        this.notifySignal(false);
      }
    }, 1000);
  }

  notifySignal(active) {
    if (this.lastNotified === active) return;
    this.lastNotified = active;
    if (this.onSignalChange) this.onSignalChange(active, this.activeSource);
  }

  markSignal() {
    this.hasSignal = true;
    this.lastFrameAt = Date.now();
    this.restartDelay = 2000;
    this.notifySignal(true);
  }

  start(sourceName) {
    if (this.activeSource === sourceName && this.captureProc) return;
    this.stopPipeline();
    this.isStopping = false;
    this.activeSource = sourceName;
    if (!sourceName) return;
    if (this.clients.size === 0) return;

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
        this.markSignal();
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
        this.markSignal();
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

    if (this.hasSignal && this.latestFrame) {
      const header = Buffer.from(
        `--mjpegboundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${this.latestFrame.length}\r\n\r\n`
      );
      res.write(header);
      res.write(this.latestFrame);
      res.write(Buffer.from('\r\n'));
    } else {
      this.broadcastPlaceholder();
    }

    if (!this.placeholderInterval) {
      this.placeholderInterval = setInterval(() => {
        if (this.clients.size > 0 && !this.hasSignal) this.broadcastPlaceholder();
      }, 2000);
    }

    res.on('close', () => {
      this.clients.delete(res);
      if (this.clients.size === 0) {
        this.stopPipeline();
        if (this.placeholderInterval) {
          clearInterval(this.placeholderInterval);
          this.placeholderInterval = null;
        }
      }
    });

    // Ensure pipeline is running for current active source
    const current = this.getActiveSource();
    if (current && !this.captureProc) {
      this.start(current);
    }
  }

  broadcastPlaceholder() {
    this.broadcastFrame(Buffer.from(PLACEHOLDER_JPEG_BASE64, 'base64'));
  }

  scheduleRestart() {
    if (this.isStopping) return;
    this.stopPipeline();
    if (this.clients.size === 0) return;
    if (!this.restartTimeout) {
      this.restartTimeout = setTimeout(() => {
        this.restartTimeout = null;
        const current = this.getActiveSource();
        if (current && this.clients.size > 0) this.start(current);
      }, this.restartDelay);
      this.restartDelay = Math.min(this.restartDelay * 2, 15000);
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
    if (this.signalWatchInterval) {
      clearInterval(this.signalWatchInterval);
      this.signalWatchInterval = null;
    }
    if (this.placeholderInterval) {
      clearInterval(this.placeholderInterval);
      this.placeholderInterval = null;
    }
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

    this.previewStream.onSignalChange = (hasSignal, sourceName) => {
      this.ndiManager.isStreamActive = hasSignal;
      if (hasSignal) {
        this.ndiManager.emit('ndiSignalDetected', sourceName);
      } else {
        this.ndiManager.emit('ndiSignalLost', sourceName);
      }
    };

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
    this.currentRecordingPath = this.exporter.getOutputPath(filename, currentSource, 'full');

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
    const outputPath = this.exporter.getOutputPath(filename, currentSource, 'clip');
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

    // Serve vendored static assets (local Tailwind)
    if (pathname === '/vendor/tailwindcss.min.js' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const js = fs.readFileSync(path.join(process.cwd(), 'vendor', 'tailwindcss.min.js'));
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.writeHead(200);
        if (req.method === 'HEAD') return res.end();
        return res.end(js);
      } catch (e) {
        res.writeHead(404);
        return res.end('not found');
      }
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
            <text x="640" y="330" font-size="80" text-anchor="middle">🎥</text>
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
        isStreamActive: this.ndiManager.isStreamActive,
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
