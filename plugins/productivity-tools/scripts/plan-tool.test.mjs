import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPureSource } from './embed.mjs';
import { canon, fnv1a, planDigest } from '../lib/plan-digest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('fnv1a matches the release fingerprint algorithm', () => {
  assert.equal(fnv1a(''), '811c9dc5');
  assert.equal(fnv1a('a'), 'e40c292c');
});

test('canon sorts keys recursively', () => {
  assert.equal(JSON.stringify(canon({ b: 1, a: { d: [{ y: 1, x: 2 }], c: 0 } })), '{"a":{"c":0,"d":[{"x":2,"y":1}]},"b":1}');
});

test('planDigest ignores key order', () => {
  const a = planDigest({ plan: { a: 1, b: 2 }, source: { path: 'p', textDigest: '0' } });
  const b = planDigest({ source: { textDigest: '0', path: 'p' }, plan: { b: 2, a: 1 } });
  assert.equal(a, b);
  assert.notEqual(a, planDigest({ plan: { a: 3, b: 2 }, source: { path: 'p', textDigest: '0' } }));
});

test('plan-digest is pure', () => {
  const text = fs.readFileSync(path.join(HERE, '..', 'lib', 'plan-digest.mjs'), 'utf8');
  assert.equal(checkPureSource(text, 'plan-digest.mjs'), null);
});

import { route } from '../lib/routing.mjs';

const ROUTING_TABLE = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'plan-tool', 'routing-table.json'), 'utf8'));

function rowTask(input) {
  const create = Array.from({ length: input.fileCount }, (_, i) => `f${i + 1}`);
  return {
    score: { ambiguity: input.ambiguity, reasoning: input.reasoning, blast: input.blast, verifiability: input.verifiability },
    files: { create, modify: [], test: [] },
    external: input.external,
  };
}

for (const row of ROUTING_TABLE.rows) {
  test(`AC3: routing table row ${row.name} (${row.source})`, () => {
    const r = route(rowTask(row.input), { hasDependents: row.input.hasDependents });
    assert.deepEqual({ tier: r.tier, effort: r.effort, reviewTier: r.reviewTier, gate: r.gate }, row.expected);
  });
}

test('route does not mutate the task', () => {
  const task = { score: { ambiguity: 0, reasoning: 0, blast: 1, verifiability: 0 }, files: { create: ['a'], modify: [], test: [] }, external: true };
  const r = route(task, { hasDependents: false });
  assert.equal(task.score.blast, 1);
  assert.equal(r.score.blast, 2);
});

test('route counts distinct files', () => {
  const task = { score: { ambiguity: 0, reasoning: 0, blast: 0, verifiability: 0 }, files: { create: ['a'], modify: [], test: ['a'] }, external: false };
  assert.equal(route(task, { hasDependents: false }).score.scope, 0);
  task.files.test = ['b'];
  assert.equal(route(task, { hasDependents: false }).score.scope, 1);
});

test('routing is pure', () => {
  const text = fs.readFileSync(path.join(HERE, '..', 'lib', 'routing.mjs'), 'utf8');
  assert.equal(checkPureSource(text, 'routing.mjs'), null);
});

// ---- Task 3: check (esquema, spec, prosa, grafo, conflito de escrita) ----
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { readDataBlock, replaceDataBlock } from '../lib/data-block.mjs';
import { checkPlan, SCHEMA } from './plan-tool.mjs';
import { checkSpec, checkRecords } from './spec-tool.mjs';

const PLAN_PATH = path.join(HERE, 'fixtures', 'plan-tool', 'plan.md');
const SPEC_PATH = path.join(HERE, 'fixtures', 'spec-tool', 'spec.md');
const TOOL = path.join(HERE, 'plan-tool.mjs');
const PLAN_TEXT = fs.readFileSync(PLAN_PATH, 'utf8');
const SPEC_TEXT = fs.readFileSync(SPEC_PATH, 'utf8');

function mutate(fn, text = PLAN_TEXT) {
  const data = structuredClone(readDataBlock(text).data);
  fn(data);
  return replaceDataBlock(text, data);
}
function mutateSpec(fn) {
  return mutate(fn, SPEC_TEXT);
}
function check(text, opts = {}) {
  return checkPlan(text, { planPath: PLAN_PATH, ...opts });
}
const find = (r, code) => r.errors.find((e) => e.code === code);
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'plan-tool-'));
function runCli(args, opts = {}) {
  return spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', ...opts });
}

test('example plan passes check with zero errors and zero warnings', () => {
  const r = check(PLAN_TEXT);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(SCHEMA, 'plan/1');
  assert.equal(r.spec.id, 'E1');
  assert.deepEqual([...r.levels], [[1, 0], [2, 1], [3, 1], [4, 1], [5, 1], [6, 2]]);
});

test('CRLF copy of the example plan passes check', () => {
  const r = check(PLAN_TEXT.replace(/\r?\n/g, '\r\n'), { specText: SPEC_TEXT.replace(/\r?\n/g, '\r\n') });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  const r2 = check('﻿' + PLAN_TEXT.replace(/\r?\n/g, '\r\n'));
  assert.deepEqual(r2.errors, []);
});

test('spec path resolves from the plan folder, not the cwd', () => {
  const ok = runCli(['check', PLAN_PATH], { cwd: os.tmpdir() });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const dir = tmpDir();
  try {
    const badSpec = path.join(dir, 'bad-spec.md');
    fs.writeFileSync(badSpec, mutateSpec((d) => delete d.rulings[0].basis));
    const bad = runCli(['check', PLAN_PATH, '--spec', badSpec], { cwd: os.tmpdir() });
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /ERROR spec-invalid/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('unreadable spec -> spec-invalid', () => {
  const r = check(mutate((d) => (d.spec = '../nao-existe/spec.md')));
  assert.ok(find(r, 'spec-invalid'));
  assert.equal(r.spec, null);
});

test('checkRecords is exported and matches checkSpec', () => {
  for (const text of [SPEC_TEXT, mutateSpec((d) => delete d.rulings[0].basis)]) {
    const s = checkSpec(text);
    const rec = checkRecords('rulings', s.data.rulings);
    const fromSpec = s.errors.filter((e) => /^R\d+$|^rulings/.test(e.ref));
    assert.deepEqual(rec.errors, fromSpec);
  }
  const broken = checkSpec(mutateSpec((d) => delete d.rulings[0].basis));
  assert.equal(checkRecords('rulings', broken.data.rulings).errors[0].code, 'ruling-incomplete');
  const many = Array.from({ length: 6 }, (_, i) => ({ id: `C${i + 1}`, input: 'a', expected: 'b' }));
  assert.equal(checkRecords('edgeCases', many).warnings[0].code, 'edge-cases-limit');
});

test('AC1: dependency cycle -> dependency-cycle naming the tasks', () => {
  const r = check(mutate((d) => (d.tasks[0].deps = [4])));
  const e = find(r, 'dependency-cycle');
  assert.ok(e, JSON.stringify(r.errors));
  assert.match(e.message, /T1 -> T4 -> T1/);
});

test('self dependency -> dependency-cycle T2 -> T2', () => {
  const r = check(mutate((d) => (d.tasks[1].deps = [2])));
  assert.match(find(r, 'dependency-cycle').message, /T2 -> T2/);
});

test('unknown dep -> dep-unknown, no exception, cycle detection and levels survive', () => {
  const r = check(mutate((d) => (d.tasks[1].deps = [9])));
  const e = find(r, 'dep-unknown');
  assert.equal(e.ref, 'T2');
  assert.match(e.message, /9/);
  assert.equal(find(r, 'dependency-cycle'), undefined);
  assert.equal(r.levels.has(2), false);
  assert.equal(r.levels.get(3), 1);
  const both = check(mutate((d) => {
    d.tasks[1].deps = [9];
    d.tasks[2].deps = [4];
    d.tasks[3].deps = [3];
  }));
  assert.ok(find(both, 'dep-unknown'));
  assert.match(find(both, 'dependency-cycle').message, /T3 -> T4 -> T3/);
});

test('AC1: two tasks of the same wave write the same file -> write-conflict', () => {
  const r = check(mutate((d) => d.tasks[3].files.create.push('src/view.mjs')));
  const e = find(r, 'write-conflict');
  assert.equal(e.ref, 'T3/T4');
  assert.match(e.message, /src\/view\.mjs/);
  const viaWrites = check(mutate((d) => d.tasks[3].writes.push('src/view.mjs')));
  assert.equal(find(viaWrites, 'write-conflict').ref, 'T3/T4');
  const viaPrefix = check(mutate((d) => d.tasks[3].writes.push('./src/view.mjs')));
  assert.equal(find(viaPrefix, 'write-conflict').ref, 'T3/T4');
  const viaBackslash = check(mutate((d) => d.tasks[3].files.modify.push('src\\view.mjs')));
  assert.equal(find(viaBackslash, 'write-conflict').ref, 'T3/T4');
  const otherLevel = check(mutate((d) => d.tasks[5].files.modify.push('src/view.mjs')));
  assert.equal(find(otherLevel, 'write-conflict'), undefined);
});

test('schema: schema-version', () => {
  const r = check(mutate((d) => (d.schema = 'plan/2')));
  assert.equal(find(r, 'schema-version').ref, 'schema');
});

test('schema: field-missing (no evidence, no score.blast)', () => {
  assert.equal(find(check(mutate((d) => delete d.evidence)), 'field-missing').ref, 'evidence');
  const r = check(mutate((d) => delete d.tasks[0].score.blast));
  const e = find(r, 'field-missing');
  assert.equal(e.ref, 'T1');
  assert.match(e.message, /score\.blast/);
  assert.equal(r.errors.length, 1);
});

test('schema: field-type (external string, score 3)', () => {
  assert.equal(find(check(mutate((d) => (d.tasks[4].external = 'no'))), 'field-type').ref, 'T5');
  const r = check(mutate((d) => (d.tasks[0].score.reasoning = 3)));
  assert.match(find(r, 'field-type').message, /score\.reasoning/);
});

test('schema: task-number', () => {
  const r = check(mutate((d) => (d.tasks[1].n = 3)));
  assert.equal(find(r, 'task-number').ref, 'T2');
});

test('schema: spec-id-mismatch', () => {
  const r = check(mutate((d) => (d.id = 'E2')));
  assert.ok(find(r, 'spec-id-mismatch'));
});

test('schema: field-unknown is a warning', () => {
  const r = check(mutate((d) => {
    d.extra = 1;
    d.tasks[0].extra = 1;
  }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.map((w) => [w.code, w.ref]), [['field-unknown', 'extra'], ['field-unknown', 'T1']]);
});

test('schema: evidence row fields', () => {
  assert.equal(find(check(mutate((d) => (d.evidence[0].kind = 'magic'))), 'field-type').ref, 'AC1');
  assert.equal(find(check(mutate((d) => delete d.evidence[0].external)), 'field-missing').ref, 'AC1');
  assert.equal(find(check(mutate((d) => (d.evidence[1].blq = 'x'))), 'field-type').ref, 'AC2');
});

test('schema: a task with no file and noCommit false -> field-missing', () => {
  const r = check(mutate((d) => (d.tasks[5].files.modify = [])));
  assert.equal(find(r, 'field-missing').ref, 'T6');
  const ok = check(mutate((d) => {
    d.tasks[5].files.modify = [];
    d.tasks[5].noCommit = true;
  }));
  assert.equal(ok.errors.length, 0);
});

test('graph and write-conflict checks are skipped when the task schema failed', () => {
  const r = check(mutate((d) => {
    d.tasks[0].deps = [4];
    delete d.tasks[2].score;
  }));
  assert.equal(find(r, 'dependency-cycle'), undefined);
  assert.ok(find(r, 'field-missing'));
});

test('prose: task-heading-missing', () => {
  const r = check(PLAN_TEXT.replace('### Tarefa 6: Documentar o armazenamento', '### Passo 6: Documentar o armazenamento'));
  assert.equal(find(r, 'task-heading-missing').ref, 'T6');
});

test('prose: task-heading-orphan', () => {
  const r = check(PLAN_TEXT.replace('## Bloco de dados', '### Task 7: Extra\n\nSobra.\n\n## Bloco de dados'));
  assert.equal(find(r, 'task-heading-orphan').ref, 'T7');
});

test('prose: task-title-differs (whitespace is collapsed)', () => {
  const r = check(PLAN_TEXT.replace('### Tarefa 2: Rejeitar item vazio', '### Tarefa 2: Rejeitar item nulo'));
  assert.equal(find(r, 'task-title-differs').ref, 'T2');
  const same = check(PLAN_TEXT.replace('### Tarefa 2: Rejeitar item vazio', '### Task 2:   Rejeitar   item vazio '));
  assert.deepEqual(same.errors, []);
});

test('ruling-incomplete via checkRecords in the plan', () => {
  const r = check(mutate((d) => delete d.rulings[0].basis));
  const e = find(r, 'ruling-incomplete');
  assert.equal(e.ref, 'R1');
  assert.match(e.message, /basis/);
});

test('data-block-missing', () => {
  const r = check('# so prosa\n');
  assert.equal(r.errors[0].code, 'data-block-missing');
  assert.equal(r.data, null);
  assert.equal(r.levels.size, 0);
});

test('CLI check: example plan exits 0', () => {
  const r = runCli(['check', PLAN_PATH]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Result: 0 errors, 0 warnings/);
});

test('CLI check: cycle exits 1, --json agrees with the text', () => {
  const dir = tmpDir();
  try {
    const p = path.join(dir, 'plan.md');
    fs.writeFileSync(p, mutate((d) => (d.tasks[0].deps = [4])));
    const spec = ['--spec', SPEC_PATH];
    const text = runCli(['check', p, ...spec]);
    assert.equal(text.status, 1);
    assert.match(text.stdout, /^ERROR dependency-cycle /m);
    const json = runCli(['check', p, ...spec, '--json']);
    assert.equal(json.status, 1);
    const out = JSON.parse(json.stdout);
    assert.equal(out.tool, 'plan-tool');
    assert.equal(out.schema, 'plan/1');
    assert.equal(out.summary.errors, text.stdout.split('\n').filter((l) => l.startsWith('ERROR')).length);
    assert.equal(out.summary.exitCode, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI check: usage errors exit 2', () => {
  assert.equal(runCli([]).status, 2);
  assert.equal(runCli(['frobnicate', PLAN_PATH]).status, 2);
  assert.equal(runCli(['check']).status, 2);
  assert.equal(runCli(['check', path.join(os.tmpdir(), 'nao-existe-plan.md')]).status, 2);
  assert.equal(runCli(['check', PLAN_PATH, '--bogus']).status, 2);
  assert.equal(runCli(['check', PLAN_PATH, '--spec']).status, 2);
});

// ---- Task 4: cobertura, interfaces, efeito externo, pasta do roadmap ----
import { EXTERNAL_PATTERNS } from './plan-tool.mjs';

const codes = (r) => r.errors.map((e) => e.code);

test('EXTERNAL_PATTERNS has the ten default patterns as strings', () => {
  assert.equal(EXTERNAL_PATTERNS.length, 10);
  assert.ok(EXTERNAL_PATTERNS.every((p) => typeof p === 'string' && new RegExp(p, 'i')));
});

test('AC1: acceptance without evidence row -> acceptance-uncovered naming AC1', () => {
  const r = check(mutate((d) => (d.evidence = d.evidence.filter((e) => e.ac !== 'AC1'))));
  const e = r.errors.find((x) => x.code === 'acceptance-uncovered');
  assert.equal(e.ref, 'AC1');
  assert.match(e.message, /evidência/);
});

test('AC1: acceptance covered by no task -> acceptance-uncovered naming AC3', () => {
  const r = check(mutate((d) => (d.tasks[3].covers = [])));
  const e = r.errors.find((x) => x.code === 'acceptance-uncovered');
  assert.equal(e.ref, 'AC3');
  assert.match(e.message, /nenhuma tarefa/);
});

test('blocked AC2 needs no covering task', () => {
  const r = check(mutate(() => {}));
  assert.equal(r.errors.length, 0);
  assert.ok(!r.data.tasks.some((t) => t.covers.includes('AC2')));
});

test('AC1: consumed interface never produced -> interface-unproduced', () => {
  const r = check(mutate((d) => (d.tasks[2].consumes = [{ task: 1, sig: 'deleteItem(id)' }])));
  const e = find(r, 'interface-unproduced');
  assert.equal(e.ref, 'T3');
  assert.match(e.message, /deleteItem\(id\)/);
});

test('interface-not-upstream when the producer is not an ancestor', () => {
  const r = check(mutate((d) => {
    d.tasks[1].produces = ['validate(item) -> ok'];
    d.tasks[3].consumes = [{ task: 2, sig: 'validate(item)   ->  ok' }];
  }));
  const e = find(r, 'interface-not-upstream');
  assert.equal(e.ref, 'T4');
  const viaChain = check(mutate((d) => {
    d.tasks[1].produces = ['validate(item) -> ok'];
    d.tasks[3].deps = [1, 2];
    d.tasks[3].consumes = [{ task: 2, sig: 'validate(item) -> ok' }];
  }));
  assert.equal(find(viaChain, 'interface-not-upstream'), undefined);
});

test('AC1: external command declared internal -> external-undeclared', () => {
  const r = check(mutate((d) => d.tasks[1].checks.push({ cmd: 'git push origin main', expect: 'exit 0' })));
  const e = find(r, 'external-undeclared');
  assert.equal(e.ref, 'T2');
  assert.match(e.message, /git/);
  const ext = check(mutate((d) => d.tasks[4].checks.push({ cmd: 'git push origin main', expect: 'exit 0' })));
  assert.equal(find(ext, 'external-undeclared'), undefined);
  const custom = check(mutate((d) => {
    d.externalPatterns = ['\\bsync-backend\\b'];
    d.tasks[1].checks.push({ cmd: 'node scripts/sync-backend.mjs', expect: 'exit 0' });
  }));
  assert.equal(find(custom, 'external-undeclared').ref, 'T2');
  const ev = check(mutate((d) => (d.evidence[0].command = 'npm publish')));
  assert.ok(ev.errors.some((e) => e.code === 'external-undeclared' && e.ref === 'AC1'));
});

test('invalid externalPatterns -> field-type', () => {
  assert.equal(find(check(mutate((d) => (d.externalPatterns = ['(']))), 'field-type').ref, 'externalPatterns');
  assert.equal(find(check(mutate((d) => (d.externalPatterns = 'x'))), 'field-type').ref, 'externalPatterns');
});

test('external task without dedupe -> external-dedupe-missing', () => {
  for (const v of [null, '']) {
    const r = check(mutate((d) => (d.tasks[4].externalDedupe = v)));
    assert.equal(find(r, 'external-dedupe-missing').ref, 'T5');
  }
});

test('evidence-kind-differs and evidence-command-differs', () => {
  assert.equal(find(check(mutate((d) => (d.evidence[0].kind = 'smoke'))), 'evidence-kind-differs').ref, 'AC1');
  assert.equal(find(check(mutate((d) => (d.evidence[0].command = 'node --test tests/other.test.mjs'))), 'evidence-command-differs').ref, 'AC1');
  const spaced = check(mutate((d) => (d.evidence[0].command = 'node  --test   tests/e1.test.mjs')));
  assert.equal(find(spaced, 'evidence-command-differs'), undefined);
});

test('cover-unknown for a task and for an evidence row', () => {
  const r = check(mutate((d) => {
    d.tasks[0].covers.push('AC9');
    d.evidence.push({ ac: 'AC9', kind: 'test', command: 'node --test x', external: false });
  }));
  const refs = r.errors.filter((e) => e.code === 'cover-unknown').map((e) => e.ref).sort();
  assert.deepEqual(refs, ['AC9', 'T1']);
});

test('edge-case-uncovered', () => {
  const r = check(mutate((d) => (d.tasks[1].covers = [])));
  assert.equal(find(r, 'edge-case-uncovered').ref, 'C1');
});

test('external-effect-unperformed', () => {
  const a = check(mutate((d) => (d.tasks[4].external = false)));
  assert.equal(find(a, 'external-effect-unperformed').ref, 'X1');
  const b = check(mutate((d) => (d.tasks[4].covers = [])));
  assert.equal(find(b, 'external-effect-unperformed').ref, 'X1');
});

test('roadmap-edit', () => {
  const r = check(mutate((d) => d.tasks[5].files.modify.push('docs/plans/roadmap-exemplo/status.md')));
  assert.equal(find(r, 'roadmap-edit').ref, 'T6');
  const other = check(mutate((d) => d.tasks[5].files.modify.push('docs/plans/roadmap-exemplo-2/status.md')));
  assert.equal(find(other, 'roadmap-edit'), undefined);
  const noRoadmap = check(mutate((d) => {
    d.roadmap = null;
    d.tasks[5].files.modify.push('docs/plans/roadmap-exemplo/status.md');
  }));
  assert.equal(find(noRoadmap, 'roadmap-edit'), undefined);
});

test('task-too-wide is a warning', () => {
  const r = check(mutate((d) => d.tasks[5].files.modify.push('a.md', 'b.md', 'c.md', 'd.md')));
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.find((w) => w.code === 'task-too-wide').ref, 'T6');
});

test('AC1: each planted defect gives its named error', () => {
  const defects = [
    ['dependency-cycle', (d) => (d.tasks[0].deps = [4])],
    ['write-conflict', (d) => d.tasks[3].files.create.push('src/view.mjs')],
    ['acceptance-uncovered', (d) => (d.evidence = d.evidence.filter((e) => e.ac !== 'AC1'))],
    ['interface-unproduced', (d) => (d.tasks[2].consumes = [{ task: 1, sig: 'deleteItem(id)' }])],
    ['external-undeclared', (d) => d.tasks[1].checks.push({ cmd: 'git push origin main', expect: 'exit 0' })],
  ];
  for (const [code, fn] of defects) {
    assert.ok(codes(check(mutate(fn))).includes(code), code);
  }
});

test('example plan stays at zero errors and warnings', () => {
  const r = check(PLAN_TEXT);
  assert.deepEqual([r.errors.length, r.warnings.length], [0, 0]);
});

// ---- Task 5: emit (resumo de integridade e cópia gerada para os workflows) ----
import vm from 'node:vm';
import { emitPlan } from './plan-tool.mjs';
import { embedFile } from './embed.mjs';

const COPY_PATH = path.join(HERE, 'fixtures', 'plan-tool', 'workflow-copy.js');
const loadCopy = () => vm.runInNewContext(fs.readFileSync(COPY_PATH, 'utf8'), Object.create(null));
const emit = (text, opts = {}) => emitPlan(text, { planPath: PLAN_PATH, cwd: path.join(HERE, '..', '..', '..'), ...opts });

test('AC2: digest changes when a block value changes', () => {
  const a = emit(PLAN_TEXT);
  assert.deepEqual(a.errors, []);
  const b = emit(mutate((d) => (d.tasks[0].checks[0].expect = 'outra coisa')));
  assert.deepEqual(b.errors, []);
  assert.notEqual(a.out.digest, b.out.digest);
  const c = emit(mutate((d) => (d.title = (d.title ?? '') + ' x')));
  assert.equal(a.out.digest === c.out.digest, false);
});

test('AC2: digest changes when only the prose changes', () => {
  const a = emit(PLAN_TEXT);
  const word = /Tarefa/;
  assert.ok(word.test(PLAN_TEXT));
  const b = emit(PLAN_TEXT.replace(/(\n[^`#\n][^\n]*?)(\w{4,})/, '$1trocada'));
  assert.deepEqual(b.errors, []);
  assert.notEqual(a.out.digest, b.out.digest);
  assert.deepEqual(a.out.plan, b.out.plan);
});

test('AC2: digest changes when the source path changes', () => {
  const a = emit(PLAN_TEXT);
  const b = emit(PLAN_TEXT, { cwd: HERE });
  assert.deepEqual(b.errors, []);
  assert.notEqual(a.out.source.path, b.out.source.path);
  assert.notEqual(a.out.digest, b.out.digest);
  assert.ok(!a.out.source.path.includes(String.fromCharCode(92)));
});

test('AC2: CRLF copy gives the same digest', () => {
  const lf = emit(PLAN_TEXT.replace(/\r\n/g, '\n'), { specText: SPEC_TEXT.replace(/\r\n/g, '\n') });
  const crlf = emit(PLAN_TEXT.replace(/\r?\n/g, '\r\n'), { specText: SPEC_TEXT.replace(/\r?\n/g, '\r\n') });
  const bom = emit('﻿' + PLAN_TEXT.replace(/\r?\n/g, '\r\n'));
  assert.deepEqual(lf.errors, []);
  assert.deepEqual(crlf.errors, []);
  assert.deepEqual(bom.errors, []);
  assert.equal(crlf.out.digest, lf.out.digest);
  assert.equal(bom.out.digest, lf.out.digest);
});

test('AC2: workflow copy recomputes the same digest', () => {
  const r = runCli(['emit', PLAN_PATH]);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.tool, 'plan-tool');
  assert.equal(out.schema, 'plan/1');
  assert.equal(loadCopy().planDigest({ plan: out.plan, source: out.source }), out.digest);
});

test('emit adds route, wave and fileCount', () => {
  const { out } = emit(PLAN_TEXT);
  const [t1, , , , t5] = out.plan.tasks;
  assert.equal(t5.route.tier, 'sonnet');
  assert.equal(t5.route.reviewTier, 'opus');
  assert.equal(t5.route.gate, true);
  assert.equal(t1.fileCount, 2);
  assert.deepEqual(out.plan.tasks.map((t) => t.wave), [1, 2, 2, 2, 2, 3]);
});

test('AC3: workflow copy routes every table row like the source', () => {
  const copy = loadCopy();
  for (const row of ROUTING_TABLE.rows) {
    const r = copy.route(rowTask(row.input), { hasDependents: row.input.hasDependents });
    assert.deepEqual({ tier: r.tier, effort: r.effort, reviewTier: r.reviewTier, gate: r.gate }, row.expected, row.name);
  }
});

test('AC3: workflow copy is not stale', () => {
  assert.equal(embedFile(COPY_PATH, { check: true }).stale, false);
});

test('workflow copy runs without process, require or crypto', () => {
  const ctx = vm.createContext(Object.create(null));
  for (const name of ['process', 'require', 'crypto']) assert.equal(vm.runInContext(`typeof ${name}`, ctx), 'undefined');
  assert.equal(typeof vm.runInContext(fs.readFileSync(COPY_PATH, 'utf8'), ctx).route, 'function');
});

test('emit CLI on a plan with errors exits 1 with empty stdout', () => {
  const dir = tmpDir();
  try {
    const bad = path.join(dir, 'plan.md');
    fs.writeFileSync(bad, mutate((d) => (d.tasks[1].deps = [9])));
    const r = runCli(['emit', bad, '--spec', SPEC_PATH]);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /ERROR dep-unknown/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
