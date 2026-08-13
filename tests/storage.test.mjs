import { test } from 'node:test';
import assert from 'node:assert';
import { parseMounts, detectBufferStorage } from '../src/storage.mjs';

const SAMPLE_MOUNTS = `overlay / overlay rw,relatime 0 0
proc /proc proc rw,nosuid,nodev,noexec,relatime 0 0
tmpfs /dev/shm tmpfs rw,nosuid,nodev,noexec,relatime,size=65536k 0 0
tmpfs /tmp/replay_buffer tmpfs rw,nosuid,nodev,relatime,size=2097152k,mode=777,inode64 0 0
/dev/sda1 /media/fireshare ext4 rw,relatime 0 0`;

test('parseMounts: detects tmpfs buffer dir with size option', () => {
  const r = parseMounts(SAMPLE_MOUNTS, '/tmp/replay_buffer');
  assert.strictEqual(r.isRam, true);
  assert.strictEqual(r.fsType, 'tmpfs');
  assert.strictEqual(r.sizeBytes, 2 * 1024 * 1024 * 1024); // 2G
  assert.strictEqual(r.mountPoint, '/tmp/replay_buffer');
});

test('parseMounts: detects size in other units (M)', () => {
  const r = parseMounts('tmpfs /mnt/buf tmpfs rw,size=512M 0 0', '/mnt/buf');
  assert.strictEqual(r.isRam, true);
  assert.strictEqual(r.sizeBytes, 512 * 1024 * 1024);
});

test('parseMounts: non-tmpfs dir is not RAM', () => {
  const r = parseMounts(SAMPLE_MOUNTS, '/media/fireshare');
  assert.strictEqual(r.isRam, false);
  assert.strictEqual(r.fsType, 'ext4');
});

test('parseMounts: unknown dir falls back to root mount (not RAM)', () => {
  const r = parseMounts(SAMPLE_MOUNTS, '/nonexistent/xyz');
  assert.strictEqual(r.isRam, false);
  assert.strictEqual(r.mountPoint, '/');
  assert.strictEqual(r.sizeBytes, 0);
});

test('parseMounts: no mount at all', () => {
  const r = parseMounts('', '/some/path');
  assert.strictEqual(r.isRam, false);
  assert.strictEqual(r.mountPoint, null);
  assert.strictEqual(r.sizeBytes, 0);
});

test('parseMounts: matches deepest mount point for nested paths', () => {
  const mounts = `tmpfs /tmp tmpfs rw,size=1024k 0 0
tmpfs /tmp/replay_buffer tmpfs rw,size=2048k 0 0`;
  const r = parseMounts(mounts, '/tmp/replay_buffer/sub');
  assert.strictEqual(r.mountPoint, '/tmp/replay_buffer');
  assert.strictEqual(r.sizeBytes, 2048 * 1024);
});

test('detectBufferStorage: returns a well-formed object for any dir', () => {
  const r = detectBufferStorage('/tmp');
  assert.ok(typeof r.isRam === 'boolean');
  assert.ok(typeof r.sizeBytes === 'number' && r.sizeBytes >= 0);
});
