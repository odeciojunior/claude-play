import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkPureSource } from './embed.mjs';
import { findDataBlocks, readDataBlock, replaceDataBlock } from '../lib/data-block.mjs';
import { checkSpec, loadRoadmap } from './spec-tool.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(HERE, '..', 'lib', 'data-block.mjs');
const dirs = [];
export function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-tool-'));
  dirs.push(d);
  return d;
}
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

const F = '```';

test('reader: no block -> data-block-missing', () => {
  assert.equal(readDataBlock('# t\n').error.code, 'data-block-missing');
});

test('reader: one block parses JSON and returns prose without it', () => {
  const r = readDataBlock(`# T\n\n${F}json data\n{"a":1}\n${F}\n\nfim\n`);
  assert.deepEqual(r.data, { a: 1 });
  assert.equal(r.line, 3);
  assert.equal(r.error, null);
  assert.ok(r.prose.includes('# T') && r.prose.includes('fim'));
  assert.ok(!r.prose.includes('"a"'));
});

test('reader: two blocks -> data-block-multiple citing both lines', () => {
  const t = `${F}json data\n{}\n${F}\n\n${F}json data\n{}\n${F}\n`;
  const r = readDataBlock(t);
  assert.equal(r.error.code, 'data-block-multiple');
  assert.match(r.error.message, /1/);
  assert.match(r.error.message, /5/);
});

test('reader: block nested in a longer fence is ignored', () => {
  const nested = `\`\`\`\`markdown\n${F}json data\n{"x":1}\n${F}\n\`\`\`\`\n`;
  const top = `${F}json data\n{"a":1}\n${F}\n`;
  const both = findDataBlocks(nested + '\n' + top);
  assert.equal(both.length, 1);
  assert.equal(both[0].line, 7);
  assert.equal(readDataBlock(nested + '\n' + top).error, null);
  assert.equal(readDataBlock(nested).error.code, 'data-block-missing');
});

test('reader: info "json" alone is not a data block', () => {
  assert.equal(readDataBlock(`${F}json\n{"a":1}\n${F}\n`).error.code, 'data-block-missing');
});

test('reader: tilde fence works', () => {
  assert.deepEqual(readDataBlock('~~~json data\n{"a":1}\n~~~\n').data, { a: 1 });
});

test('reader: unclosed fence is not a data block', () => {
  assert.equal(readDataBlock(`${F}json data\n{"a":1}\n`).error.code, 'data-block-missing');
});

test('reader: CRLF and BOM', () => {
  const r = readDataBlock(`\uFEFF# T\r\n\r\n${F}json data\r\n{"a":1}\r\n${F}\r\n`);
  assert.deepEqual(r.data, { a: 1 });
  assert.equal(r.error, null);
});

test('reader: invalid JSON -> data-block-json with parser message', () => {
  const r = readDataBlock(`${F}json data\n{a:\n${F}\n`);
  assert.equal(r.error.code, 'data-block-json');
  assert.ok(r.error.message.length > 0);
});

test('replaceDataBlock keeps prose and rewrites body', () => {
  const t = `# T\n\nantes\n\n${F}json data\n{"a":1}\n${F}\n\ndepois\n`;
  const out = replaceDataBlock(t, { b: [2] });
  assert.deepEqual(readDataBlock(out).data, { b: [2] });
  assert.equal(readDataBlock(out).prose, readDataBlock(t).prose);
  assert.ok(out.startsWith('# T\n\nantes\n\n') && out.endsWith('\n\ndepois\n'));
  assert.throws(() => replaceDataBlock('# t\n', {}));
});

test('lib/data-block.mjs is pure source', () => {
  assert.equal(checkPureSource(fs.readFileSync(LIB, 'utf8'), 'data-block.mjs'), null);
});

// ---- Task 3: esquema spec/1 e check sem roadmap ----

const SCRIPT = path.join(HERE, 'spec-tool.mjs');
const FIXTURE_SPEC = path.join(HERE, 'fixtures', 'spec-tool', 'spec.md');

function mutate(fn) {
  const text = fs.readFileSync(FIXTURE_SPEC, 'utf8');
  const data = JSON.parse(JSON.stringify(readDataBlock(text).data));
  fn(data);
  return replaceDataBlock(text, data);
}
const codes = (r) => r.errors.map((e) => `${e.code}:${e.ref}`);
const find = (r, code) => r.errors.find((e) => e.code === code);
function runCli(args, text) {
  const d = tmp();
  const p = path.join(d, 'spec.md');
  if (text !== undefined) fs.writeFileSync(p, text);
  const res = spawnSync(process.execPath, [SCRIPT, ...args.map((a) => (a === '$SPEC' ? p : a))], { encoding: 'utf8' });
  return res;
}

test('AC2: fixture passes schema check with no errors', () => {
  const r = checkSpec(fs.readFileSync(FIXTURE_SPEC, 'utf8'));
  assert.deepEqual(r.errors, []);
  assert.equal(r.data.id, 'E1');
});

for (const field of ['basis', 'costIfWrong', 'reversible', 'scope']) {
  test(`AC2: ruling without ${field} -> ruling-incomplete naming R1`, () => {
    const r = checkSpec(mutate((d) => { delete d.rulings[0][field]; }));
    const e = find(r, 'ruling-incomplete');
    assert.ok(e, JSON.stringify(r.errors));
    assert.equal(e.ref, 'R1');
    assert.ok(e.message.includes(field));
  });
}
for (const [field, bad] of [['basis', ''], ['costIfWrong', 'huge'], ['reversible', 'no'], ['scope', 'global']]) {
  test(`AC2: ruling with ${field} out of domain -> ruling-incomplete naming R1`, () => {
    const r = checkSpec(mutate((d) => { d.rulings[0][field] = bad; }));
    const e = find(r, 'ruling-incomplete');
    assert.ok(e, JSON.stringify(r.errors));
    assert.equal(e.ref, 'R1');
    assert.ok(e.message.includes(field));
  });
}

test('AC2: needsPerson without blocking -> needs-person-blocking naming H1', () => {
  let r = checkSpec(mutate((d) => { delete d.needsPerson[0].blocking; }));
  assert.equal(find(r, 'needs-person-blocking').ref, 'H1');
  r = checkSpec(mutate((d) => { d.needsPerson[0].blocking = 'yes'; }));
  assert.equal(find(r, 'needs-person-blocking').ref, 'H1');
});

test('AC2: non-blocking item without workaround -> needs-person-workaround', () => {
  const r = checkSpec(mutate((d) => { d.needsPerson[1].workaround = ''; }));
  assert.equal(find(r, 'needs-person-workaround').ref, 'H2');
});

test('needsPerson kind out of domain -> needs-person-kind', () => {
  const r = checkSpec(mutate((d) => { d.needsPerson[0].kind = 'other'; }));
  assert.equal(find(r, 'needs-person-kind').ref, 'H1');
});

test('schema: wrong version -> schema-version', () => {
  const r = checkSpec(mutate((d) => { d.schema = 'spec/2'; }));
  assert.ok(find(r, 'schema-version'));
});

test('missing acceptance -> field-missing', () => {
  const r = checkSpec(mutate((d) => { delete d.acceptance; }));
  const e = find(r, 'field-missing');
  assert.equal(e.ref, 'acceptance');
});

test('rulings item not object -> field-type', () => {
  const r = checkSpec(mutate((d) => { d.rulings[1] = 'x'; }));
  assert.equal(find(r, 'field-type').ref, 'rulings[2]');
});

test('id R1 repeated -> id-duplicate', () => {
  const r = checkSpec(mutate((d) => { d.rulings[1].id = 'R1'; }));
  assert.equal(find(r, 'id-duplicate').ref, 'R1');
});

test('acceptance id AC2 at position 1 -> id-invalid', () => {
  const r = checkSpec(mutate((d) => { d.acceptance[0].id = 'AC2'; }));
  assert.ok(codes(r).includes('id-invalid:AC2'), JSON.stringify(r.errors));
});

test('invalid verify tag -> acceptance-tag-invalid', () => {
  const r = checkSpec(mutate((d) => { d.acceptance[0].text = 'Algo. {verify: maybe}'; }));
  assert.equal(find(r, 'acceptance-tag-invalid').ref, 'AC1');
});

test('unknown field -> field-unknown warning', () => {
  const r = checkSpec(mutate((d) => { d.extra = 1; d.rulings[0].zzz = 2; }));
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.filter((w) => w.code === 'field-unknown').length, 2);
});

test('six edge cases -> edge-cases-limit warning', () => {
  const r = checkSpec(mutate((d) => {
    d.edgeCases = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `C${n}`, input: 'i', expected: 'e' }));
  }));
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.code === 'edge-cases-limit'));
});

test('missing mode -> field-missing; mode "batch" -> field-type', () => {
  let r = checkSpec(mutate((d) => { delete d.mode; }));
  assert.equal(find(r, 'field-missing').ref, 'mode');
  r = checkSpec(mutate((d) => { d.mode = 'batch'; }));
  assert.equal(find(r, 'field-type').ref, 'mode');
});

test('falsy values are not missing', () => {
  const r = checkSpec(mutate((d) => {
    d.rulings[0].reversible = false;
    d.rulings[0].alternative = '';
    d.rulings[0].contradicts = null;
    d.needsPerson[1].blocking = false;
  }));
  assert.deepEqual(r.errors, []);
});

test('reader error becomes the same code with ref "-"', () => {
  const r = checkSpec('# nada\n');
  assert.deepEqual(r.errors.map((e) => [e.code, e.ref]), [['data-block-missing', '-']]);
  assert.equal(r.data, null);
});

test('CLI check: fixture exits 0 without --roadmap', () => {
  const r = runCli(['check', FIXTURE_SPEC]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Result: 0 errors, 1 warnings/);
});

test('CLI check: ruling without basis exits 1 with ERROR line; --json agrees', () => {
  const text = mutate((d) => { delete d.rulings[0].basis; });
  const t = runCli(['check', '$SPEC'], text);
  assert.equal(t.status, 1);
  assert.match(t.stdout, /^ERROR ruling-incomplete R1:/m);
  const n = t.stdout.split('\n').filter((l) => l.startsWith('ERROR ')).length;
  const j = runCli(['check', '$SPEC', '--json'], text);
  assert.equal(j.status, 1);
  const out = JSON.parse(j.stdout);
  assert.equal(out.tool, 'spec-tool');
  assert.equal(out.schema, 'spec/1');
  assert.equal(out.summary.errors, n);
  assert.equal(out.summary.exitCode, 1);
});

test('CLI check: invalid usage exits 2', () => {
  assert.equal(runCli([]).status, 2);
  assert.equal(runCli(['bogus', FIXTURE_SPEC]).status, 2);
  assert.equal(runCli(['check', path.join(os.tmpdir(), 'nao-existe-spec.md')]).status, 2);
  assert.equal(runCli(['check']).status, 2);
});

// ---- Task 4: check --roadmap contra o card ----

const FIXTURE_ROADMAP = path.join(HERE, 'fixtures', 'spec-tool', 'roadmap');
const STRATEGY_TEXT = fs.readFileSync(path.join(FIXTURE_ROADMAP, 'strategy.md'), 'utf8');
const STATE_TEXT = fs.readFileSync(path.join(FIXTURE_ROADMAP, 'state.md'), 'utf8');

function roadmapFrom(strategy, state = STATE_TEXT) {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'strategy.md'), strategy);
  fs.writeFileSync(path.join(d, 'state.md'), state);
  fs.copyFileSync(path.join(FIXTURE_ROADMAP, 'roadmap.config.json'), path.join(d, 'roadmap.config.json'));
  return d;
}
const FIX = () => fs.readFileSync(FIXTURE_SPEC, 'utf8');

test('loadRoadmap reads cards and open blockers', () => {
  const r = loadRoadmap(FIXTURE_ROADMAP);
  assert.equal(r.cards.length, 1);
  assert.equal(r.cards[0].acceptance.length, 3);
  assert.deepEqual([...r.openBlockers], ['BLQ-1']);
  assert.throws(() => loadRoadmap(path.join(os.tmpdir(), 'nao-existe-roadmap')), /roadmap/);
  const d = tmp();
  fs.writeFileSync(path.join(d, 'roadmap.config.json'), '{nope');
  assert.throws(() => loadRoadmap(d), /roadmap/);
});

test('AC1: fixture passes check --roadmap with exit 0 and no warnings', () => {
  const r = runCli(['check', FIXTURE_SPEC, '--roadmap', FIXTURE_ROADMAP]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout.trim().split('\n').pop(), /^Result: 0 errors, 0 warnings$/);
});

test('AC1: changed criterion text -> acceptance-text naming AC1', () => {
  const r = checkSpec(mutate((d) => { d.acceptance[0].text = d.acceptance[0].text.replace('stored', 'deleted'); }), { roadmap: loadRoadmap(FIXTURE_ROADMAP) });
  const e = find(r, 'acceptance-text');
  assert.ok(e, JSON.stringify(r.errors));
  assert.equal(e.ref, 'AC1');
  assert.ok(e.message.includes('Given an empty system'));
});

test('AC1: tag removed -> acceptance-tag-missing', () => {
  const r = checkSpec(mutate((d) => { d.acceptance[0].text = d.acceptance[0].text.replace(/\s*\{verify:.*$/, ''); }), { roadmap: loadRoadmap(FIXTURE_ROADMAP) });
  assert.equal(find(r, 'acceptance-tag-missing').ref, 'AC1');
});

test('AC1: evidence changed -> acceptance-tag-differs and kind changed -> acceptance-tag-differs', () => {
  const rm = loadRoadmap(FIXTURE_ROADMAP);
  let r = checkSpec(mutate((d) => { d.acceptance[0].text = d.acceptance[0].text.replace('tests/e1.test.mjs', 'tests/outro.test.mjs'); }), { roadmap: rm });
  assert.equal(find(r, 'acceptance-tag-differs').ref, 'AC1');
  r = checkSpec(mutate((d) => { d.acceptance[1].text = d.acceptance[1].text.replace('BLQ-1', 'BLQ-2'); }), { roadmap: rm });
  assert.equal(find(r, 'acceptance-tag-differs').ref, 'AC2');
  r = checkSpec(mutate((d) => { d.acceptance[0].text = d.acceptance[0].text.replace('verify: test', 'verify: smoke'); }), { roadmap: rm });
  assert.equal(find(r, 'acceptance-tag-differs').ref, 'AC1');
});

test('AC1: one criterion fewer -> acceptance-count', () => {
  const r = checkSpec(mutate((d) => { d.acceptance.pop(); }), { roadmap: loadRoadmap(FIXTURE_ROADMAP) });
  assert.ok(find(r, 'acceptance-count'), JSON.stringify(r.errors));
});

test('AC1: whitespace, line-ending and NFD-only differences pass', () => {
  const nfd = STRATEGY_TEXT.replace('shown back', 'shown baçk');
  const rm = loadRoadmap(roadmapFrom(nfd));
  const r = checkSpec(mutate((d) => {
    d.acceptance[0].text = d.acceptance[0].text.replace('when a user', 'when  a\nuser').replace('shown back', 'shown baçk');
  }), { roadmap: rm });
  assert.deepEqual(r.errors, []);
  const changed = checkSpec(mutate((d) => { d.acceptance[0].text = d.acceptance[0].text.replace('shown back', 'shown away'); }), { roadmap: loadRoadmap(FIXTURE_ROADMAP) });
  assert.ok(find(changed, 'acceptance-text'));
});

test('CRLF copy of the fixture passes check', () => {
  const crlf = (t) => t.replace(/\r?\n/g, '\r\n');
  const d = roadmapFrom(crlf(STRATEGY_TEXT), crlf(STATE_TEXT));
  const r = checkSpec(crlf(FIX()), { roadmap: loadRoadmap(d) });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('AC2: closed blq -> needs-person-blq', () => {
  const r = checkSpec(mutate((d) => { d.needsPerson[0].blq = 'BLQ-9'; }), { roadmap: loadRoadmap(FIXTURE_ROADMAP) });
  const e = find(r, 'needs-person-blq');
  assert.ok(e, JSON.stringify(r.errors));
  assert.equal(e.ref, 'H1');
});

test('card id not in roadmap -> card-not-found', () => {
  const r = checkSpec(mutate((d) => { d.id = 'E9'; }), { roadmap: loadRoadmap(FIXTURE_ROADMAP) });
  assert.ok(find(r, 'card-not-found'));
});

test('E<n> without --roadmap -> card-not-checked warning, exit 0; kebab-case id -> zero warnings', () => {
  let r = runCli(['check', FIXTURE_SPEC]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^WARN card-not-checked/m);
  r = runCli(['check', '$SPEC'], mutate((d) => { d.id = 'spec-writer'; }));
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /Result: 0 errors, 0 warnings/);
});

test('--roadmap on missing folder -> exit 2', () => {
  assert.equal(runCli(['check', FIXTURE_SPEC, '--roadmap', path.join(os.tmpdir(), 'nao-existe-roadmap')]).status, 2);
  assert.equal(runCli(['check', FIXTURE_SPEC, '--roadmap']).status, 2);
});
