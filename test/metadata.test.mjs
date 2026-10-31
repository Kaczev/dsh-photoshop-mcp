import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('package PNG icon fits DSH 256 KiB metadata limit', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const icon = await readFile(new URL('../' + manifest.exports['./icon'].replace(/^\.\//, ''), import.meta.url));
  assert.ok(icon.length <= 256 * 1024, `Icon is ${icon.length} bytes; DSH accepts at most 262144`);
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(icon[25],6,'Icon must retain RGBA transparency');
  assert.equal(icon.readUInt32BE(16), 256);
  assert.equal(icon.readUInt32BE(20), 256);
});
