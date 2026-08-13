import { spawn } from 'child_process';
import { resolveNdiCaptureBin } from './ndi.mjs';

export const QUALITY_SCALE = {
  '1080p': '1920:1080',
  '1440p': '2560:1440',
  '4k': '3840:2160'
};

export function resolveScale(recordQuality) {
  if (!recordQuality) return null;
  return QUALITY_SCALE[String(recordQuality).toLowerCase()] || null;
}

const FALLBACK_LAVFI = [
  '-f', 'lavfi',
  '-i', 'testsrc2=size=1280x720:rate=30',
  '-f', 'lavfi',
  '-i', 'sine=frequency=440:sample_rate=48000',
  '-c:v', 'libx264',
  '-preset', 'ultrafast',
  '-tune', 'zerolatency',
  '-c:a', 'aac'
];

export function spawnEncoder({ sourceName, ffmpegArgs, resTimeoutMs = 3000, forceLavfi = false, onFallback = null }) {
  const state = { capture: null, ffmpeg: null, ffmpegStarted: false, timer: null, stopped: false, fallback: false };

  const startFfmpeg = (videoSize) => {
    if (state.ffmpegStarted) return;
    state.ffmpegStarted = true;
    if (state.timer) clearTimeout(state.timer);

    if (!videoSize) {
      state.ffmpeg = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...FALLBACK_LAVFI, ...ffmpegArgs]);
    } else {
      state.ffmpeg = spawn('ffmpeg', [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-fflags', 'nobuffer',
        '-flags', 'low_delay',
        '-probesize', '32',
        '-analyzeduration', '0',
        '-f', 'rawvideo',
        '-pixel_format', 'bgra',
        '-video_size', videoSize,
        '-i', '-',
        ...ffmpegArgs
      ]);
      if (state.capture) {
        state.ffmpeg.stdin.on('error', () => {});
        state.capture.stdout.pipe(state.ffmpeg.stdin);
        state.capture.stdout.resume();
      }
    }
    if (state.ffmpeg.unref) state.ffmpeg.unref();
  };

  const fallback = () => {
    if (!forceLavfi && !state.lavfiWarned) {
      state.lavfiWarned = true;
      console.warn('[Encoder] NDI capture unavailable or failed — recording lavfi test pattern instead of the stream');
      state.fallback = true;
      if (onFallback) onFallback();
    }
    startFfmpeg(null);
  };

  const ndiBin = resolveNdiCaptureBin();
  if (ndiBin && sourceName && !forceLavfi) {
    state.capture = spawn(ndiBin, ['--stream', sourceName], {
      env: { ...process.env, LD_LIBRARY_PATH: '/usr/local/lib:' + (process.env.LD_LIBRARY_PATH || '') }
    });
    if (state.capture.unref) state.capture.unref();
    state.capture.stdout.pause();

    state.capture.stderr.on('data', chunk => {
      const match = chunk.toString().match(/RES\s+(\d+)x(\d+)/);
      if (match) startFfmpeg(match[1] + 'x' + match[2]);
    });
    state.capture.on('exit', () => { if (!state.ffmpegStarted && !state.stopped) fallback(); });
    state.capture.on('error', () => { if (!state.ffmpegStarted && !state.stopped) fallback(); });

    state.timer = setTimeout(() => {
      if (!state.ffmpegStarted && !state.stopped) fallback();
    }, resTimeoutMs);
    if (state.timer.unref) state.timer.unref();
  } else {
    fallback();
  }

  state.stop = () => {
    state.stopped = true;
    if (state.timer) clearTimeout(state.timer);
    if (state.capture) { try { state.capture.kill('SIGTERM'); } catch (e) {} }
    if (state.ffmpeg) { try { state.ffmpeg.kill('SIGTERM'); } catch (e) {} }
  };

  return {
    get ffmpeg() { return state.ffmpeg; },
    get capture() { return state.capture; },
    get fallback() { return state.fallback; },
    stop: state.stop
  };
}
