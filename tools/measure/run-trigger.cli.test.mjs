import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('CLI dry-run passes --plugin-dir as an absolute path', () => {
  const r = spawnSync(process.execPath, [new URL('./run-trigger.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    '--plugin-dir', 'plugins/productivity-tools', '--work', join(tmpdir(), 'rt-work-x'), '--out', join(tmpdir(), 'rt-out-x.md'), '--dry-run', '--lang', 'pt'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(JSON.stringify(resolve('plugins/productivity-tools')).slice(1, -1)), r.stdout.slice(0, 300));
});
