import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGINS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXT = new Set(['.mjs', '.js', '.md', '.json', '.py']);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (EXT.has(path.extname(e.name))) yield p;
  }
}

function invalidUtf8(files) {
  const dec = new TextDecoder('utf-8', { fatal: true });
  const bad = [];
  for (const f of files) {
    try { dec.decode(fs.readFileSync(f)); } catch { bad.push(f); }
  }
  return bad;
}

test('todo .mjs, .js, .md, .json e .py de plugins/ e UTF-8 valido', () => {
  const files = [...walk(PLUGINS)];
  assert.ok(files.length > 50, `so ${files.length} arquivos varridos`);
  const bad = invalidUtf8(files).map((f) => path.relative(PLUGINS, f).replace(/\\/g, '/'));
  assert.deepEqual(bad, [], `arquivos que nao decodificam como UTF-8:\n${bad.join('\n')}`);
});

test('o detector acusa bytes Latin-1 num arquivo UTF-8', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enc-'));
  try {
    const ok = path.join(dir, 'ok.mjs');
    const ruim = path.join(dir, 'ruim.mjs');
    fs.writeFileSync(ok, 'inválido\n', 'utf8');
    fs.writeFileSync(ruim, Buffer.from('inv\xe1lido\n', 'latin1'));
    assert.deepEqual(invalidUtf8([ok, ruim]), [ruim]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
