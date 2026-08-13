import fs from 'fs';

const TMPFS_MAGIC = 0x01021994;

export function parseMounts(mountsContent, targetDir) {
  const resolved = targetDir;
  let best = null;
  for (const line of mountsContent.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const [dev, mountPoint, fsType, options] = parts;
    if (resolved === mountPoint || resolved.startsWith(mountPoint.replace(/\/$/, '') + '/')) {
      if (!best || mountPoint.length > best.mountPoint.length) {
        best = { dev, mountPoint, fsType, options };
      }
    }
  }
  if (!best) return { isRam: false, fsType: null, sizeBytes: 0, mountPoint: null };

  let sizeBytes = 0;
  const sizeMatch = best.options.match(/(?:^|,)size=(\d+)([kKmMgG]?)(?:,|$)/);
  if (sizeMatch) {
    const multiplier = { '': 1, k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024, K: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024 };
    sizeBytes = parseInt(sizeMatch[1], 10) * (multiplier[sizeMatch[2]] || 1);
  }

  return {
    isRam: best.fsType === 'tmpfs' || best.fsType === 'ramfs',
    fsType: best.fsType,
    sizeBytes,
    mountPoint: best.mountPoint
  };
}

export function detectBufferStorage(dir) {
  try {
    const mounts = fs.readFileSync('/proc/mounts', 'utf8');
    const parsed = parseMounts(mounts, dir);
    if (parsed.mountPoint) return parsed;
  } catch (e) {}

  let sizeBytes = 0;
  let isRam = false;
  try {
    const stats = fs.statfsSync(dir);
    sizeBytes = stats.bsize * stats.blocks;
    isRam = stats.type === TMPFS_MAGIC;
  } catch (e) {}

  return { isRam, fsType: isRam ? 'tmpfs' : null, sizeBytes, mountPoint: null };
}
