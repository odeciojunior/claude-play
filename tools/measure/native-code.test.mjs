import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeSandbox } from '../../plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.mjs';
import { runSandboxSuite, readText } from './make-scenario.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const NATIVE = join(here, 'scenario', 'e5-native');
const CODE = join(NATIVE, 'code');

function walk(dir, base = dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(relative(base, p).replaceAll(sep, '/'));
  }
  return out;
}

// The "Files:" line of every "### Tarefa n:" section of the native plan lists its files between backticks.
function planFiles() {
  const plan = readText(join(NATIVE, 'plan.md'));
  const files = [];
  for (const m of plan.matchAll(/^Files: (.*?)\. Locks:/gm)) {
    for (const f of m[1].matchAll(/`([^`]+)`/g)) files.push(f[1]);
  }
  return files.sort();
}

test('native code files match the plan file list', () => {
  const want = planFiles();
  assert.equal(want.length, 6);
  const got = [];
  for (const t of ['t1', 't2', 't3']) got.push(...walk(join(CODE, t)));
  assert.deepEqual(got.sort(), want);
  assert.ok(!got.some((f) => /index\.mjs$/.test(f)));
});

test('truncate counts code points (R2)', async () => {
  const src = readText(join(CODE, 't2', 'src', 'truncate.mjs'));
  assert.ok(/\[\.\.\.|Array\.from\(/.test(src), 'truncate must split into code points');
  assert.ok(!/text\.length|\.slice\(0, max/.test(src.replace(/cps\.slice/g, '')), 'no UTF-16 length/slice on the text');
  const { truncate } = await import(pathToFileURL(join(CODE, 't2', 'src', 'truncate.mjs')).href);
  assert.equal(truncate('a😀b', 2), 'a…');
  assert.equal(truncate('a😀b', 3), 'a😀b');
  assert.equal(Array.from(truncate('a😀b😀c', 3)).length, 3);
});

test('sandbox suite is green with T1..T3', { skip: process.env.E11_SANDBOX_SUITE !== '1' }, () => {
  const base = mkdtempSync(join(tmpdir(), 'native-code-'));
  try {
    const dir = makeSandbox(join(base, 'sb'));
    const before = new Set(walk(dir).filter((f) => !f.startsWith('.git/')));
    const copied = [];
    for (const t of ['t1', 't2', 't3']) {
      for (const f of walk(join(CODE, t))) {
        mkdirSync(dirname(join(dir, f)), { recursive: true });
        copyFileSync(join(CODE, t, f), join(dir, f));
        copied.push(f);
      }
    }
    const r = runSandboxSuite(dir);
    assert.equal(r.status, 0, r.output);
    const after = walk(dir).filter((f) => !f.startsWith('.git/') && !before.has(f));
    assert.deepEqual(after.sort(), copied.sort());
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
