import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOALS, NOT_APPLICABLE, plannerLoad, trackerMaxEventLoad, measureGoals } from './prose-goals.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLANNER = 'plugins/productivity-tools/skills/roadmap-planner';
const TRACKER = 'plugins/productivity-tools/skills/roadmap-tracker';
const readDisk = (rel) => readFileSync(join(ROOT, rel), 'utf8');
function listDisk(rel) {
  const walk = (dir, base) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (
    e.isDirectory() ? walk(`${dir}/${e.name}`, `${base}${e.name}/`) : [`${base}${e.name}`]));
  return walk(rel, '');
}
const lf = (t) => Buffer.byteLength(t.replace(/\r\n?/g, '\n'));
const goal = (rows, d) => rows.find((r) => r.deliverable === d);

test('E17: planner load equals the E4 budget definition', () => {
  const files = ['SKILL.md', 'references/clarify.md', 'references/decompose.md', 'references/model.md'];
  const expected = files.reduce((s, f) => s + lf(readDisk(`${PLANNER}/${f}`)), 0);
  const got = plannerLoad(readDisk);
  assert.equal(got.bytes, expected);
  assert.equal(got.files.length, 4);
  assert.ok(got.bytes <= 43335, `planner load ${got.bytes}`);
});

test('E17: tracker max event load equals the E22 budget test', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', 'plugins/productivity-tools/scripts/prose-budget.test.mjs'], { encoding: 'utf8', env, cwd: ROOT });
  const m = /largest load: (\d+) [^=]*= (\d+) bytes LF/.exec(r.stdout);
  assert.ok(m, `no diagnostic in output: ${r.stdout.slice(0, 500)}`);
  const got = trackerMaxEventLoad(readDisk, listDisk);
  assert.equal(got.bytes, Number(m[2]));
  assert.equal(String(got.event).split(' ')[0], m[1]);
  assert.ok(got.bytes <= 29096);
});

test('E17: measureGoals marks each goal with its measured value', () => {
  const rows = measureGoals(readDisk, listDisk);
  assert.equal(goal(rows, 'E4').verdict, 'atingida');
  assert.equal(typeof goal(rows, 'E4').measured, 'number');
  assert.equal(goal(rows, 'E22').verdict, 'atingida');
  assert.equal(typeof goal(rows, 'E22').measured, 'number');
  assert.equal(goal(rows, 'E4').target, GOALS[0].target);
  for (const d of NOT_APPLICABLE) {
    assert.equal(goal(rows, d).verdict, 'não aplicável neste ponto');
    assert.equal(goal(rows, d).measured, null);
  }
  const inflated = (rel) => (rel === `${PLANNER}/SKILL.md` ? readDisk(rel) + 'x'.repeat(50000) : readDisk(rel));
  const over = goal(measureGoals(inflated, listDisk), 'E4');
  assert.equal(over.verdict, 'não atingida');
  assert.ok(over.measured > 43335);
});

test('E17: CRLF text measures the same as LF', () => {
  const crlf = (rel) => readDisk(rel).replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n');
  assert.deepEqual(plannerLoad(crlf), plannerLoad(readDisk));
  assert.deepEqual(trackerMaxEventLoad(crlf, listDisk), trackerMaxEventLoad(readDisk, listDisk));
});

test('E17: a missing definition file leaves the goal not measured', () => {
  const noModel = (rel) => {
    if (rel === `${PLANNER}/references/model.md`) throw new Error('ENOENT');
    return readDisk(rel);
  };
  const a = measureGoals(noModel, listDisk);
  assert.equal(goal(a, 'E4').verdict, 'não medida');
  assert.equal(goal(a, 'E4').measured, null);
  assert.equal(goal(a, 'E22').verdict, 'atingida');
  const noEvents = (rel) => listDisk(rel).filter((f) => !f.startsWith('events/'));
  const b = measureGoals(readDisk, noEvents);
  assert.equal(goal(b, 'E22').verdict, 'não medida');
  assert.equal(goal(b, 'E22').measured, null);
  assert.equal(goal(b, 'E4').verdict, 'atingida');
  const nullRead = (rel) => (rel.endsWith('model.md') ? null : readDisk(rel));
  assert.equal(goal(measureGoals(nullRead, listDisk), 'E4').verdict, 'não medida');
});
