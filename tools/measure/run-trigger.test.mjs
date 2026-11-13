import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTranscript, scoreCase, renderTable } from './run-trigger.mjs';

const fx = (n) => readFileSync(new URL(`./fixtures/trigger/${n}`, import.meta.url), 'utf8');
const PW = 'productivity-tools:plan-writer';

test('parses the first Skill call and superpowers present', () => {
  const p = parseTranscript(fx('hit-superpowers-on.jsonl'));
  assert.equal(p.skill, PW);
  assert.equal(p.superpowers, true);
  assert.ok(p.plugins.includes('productivity-tools'));
});

test('parses a wrong skill with superpowers absent, CRLF and a blank line', () => {
  const p = parseTranscript(fx('wrong-skill-superpowers-off.jsonl'));
  assert.equal(p.skill, 'productivity-tools:roadmap-planner');
  assert.equal(p.superpowers, false);
});

test('a transcript without init and with a non-JSON line does not throw', () => {
  const line = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: PW } }] } });
  const p = parseTranscript(`not json\n${line}\n`);
  assert.equal(p.superpowers, 'unknown');
  assert.equal(p.skill, PW);
  assert.deepEqual(p.plugins, []);
});

test('scoreCase marks hit and miss', () => {
  const c = { id: 'a', category: 'plan', lang: 'pt', expect: PW };
  const hit = scoreCase(c, parseTranscript(fx('hit-superpowers-on.jsonl')));
  const miss = scoreCase(c, parseTranscript(fx('wrong-skill-superpowers-off.jsonl')));
  assert.equal(hit.hit, true);
  assert.equal(miss.hit, false);
  assert.equal(hit.got, PW);
  assert.equal(hit.superpowers, true);
});

test('renderTable lists each case and the hits per category', () => {
  const c = { category: 'plan', lang: 'pt', expect: PW };
  const out = renderTable([
    scoreCase({ ...c, id: 'c1' }, parseTranscript(fx('hit-superpowers-on.jsonl'))),
    scoreCase({ ...c, id: 'c2' }, parseTranscript(fx('wrong-skill-superpowers-off.jsonl'))),
  ]);
  assert.match(out, /\| id \| lang \| category \| expect \| got \| hit \| superpowers \|/);
  assert.match(out, /\| c1 \|/);
  assert.match(out, /\| c2 \|/);
  assert.match(out, /\| category \| hits \| total \|/);
  assert.match(out, /\| plan \| 1 \| 2 \|/);
});

// ---- Tarefa 8: casos, executor e dry-run ----
import { mkdtempSync, readFileSync as rf, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildArgs, runTrigger } from './run-trigger.mjs';

const CASES_FILE = new URL('./trigger/cases.json', import.meta.url);
const CATEGORY_EXPECT = {
  spec: 'productivity-tools:spec-writer',
  plan: 'productivity-tools:plan-writer',
  roadmap: 'productivity-tools:roadmap-planner',
  'plan-execution': 'productivity-tools:plan-coordinator',
};

test('cases.json covers four categories with at least three cases each', () => {
  const { cases } = JSON.parse(rf(CASES_FILE, 'utf8'));
  const ids = cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const count = {};
  for (const c of cases) {
    assert.ok(c.prompt.pt?.trim(), `${c.id} pt`);
    assert.ok(c.prompt.en?.trim(), `${c.id} en`);
    assert.equal(c.expect, CATEGORY_EXPECT[c.category], `${c.id} expect`);
    count[c.category] = (count[c.category] ?? 0) + 1;
  }
  for (const cat of Object.keys(CATEGORY_EXPECT)) assert.ok(count[cat] >= 3, `${cat} has ${count[cat]}`);
  const byId = new Map(cases.map((c) => [c.id, c]));
  const pairs = new Set();
  for (const c of cases) {
    if (!c.pairOf) continue;
    const other = byId.get(c.pairOf);
    assert.ok(other, `${c.id} pairOf ${c.pairOf} exists`);
    pairs.add([c.category, other.category].sort().join('|'));
  }
  assert.ok(pairs.has('plan|roadmap'));
  assert.ok(pairs.has('plan|plan-execution'));
});

test('buildArgs keeps the prompt as one argument', () => {
  const prompt = 'faça o "plano" de  tarefas';
  const a = buildArgs(prompt, { pluginDir: 'plugins/productivity-tools' });
  assert.deepEqual(a, ['-p', prompt, '--plugin-dir', 'plugins/productivity-tools', '--output-format', 'stream-json', '--verbose', '--max-turns', '2']);
  assert.equal(a.filter((x) => x === prompt).length, 1);
});

test('dry-run lists one command per case and language without spawning', async () => {
  const { cases } = JSON.parse(rf(CASES_FILE, 'utf8'));
  const lines = [];
  const r = await runTrigger(
    { casesFile: CASES_FILE, pluginDir: 'plugins/productivity-tools', work: join(tmpdir(), 'nope-work'), out: join(tmpdir(), 'nope-out.md'), lang: 'both', dryRun: true },
    { spawn: () => { throw new Error('spawned'); }, log: (l) => lines.push(l) },
  );
  assert.equal(r.exitCode, 0);
  assert.equal(lines.length, 2 * cases.length);
  for (const l of lines) {
    assert.match(l, /--plugin-dir/);
    assert.match(l, /stream-json/);
    assert.match(l, /--max-turns 2/);
  }
});

test('run scores cases from recorded transcripts', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'trigger-test-'));
  try {
    const out = join(tmp, 'out', 'trigger.md');
    const r = await runTrigger(
      { casesFile: CASES_FILE, pluginDir: 'plugins/productivity-tools', work: join(tmp, 'work'), out, lang: 'pt' },
      { spawn: async () => ({ stdout: fx('no-skill.jsonl'), code: 0 }), log: () => {} },
    );
    assert.equal(r.exitCode, 0);
    assert.ok(r.results.length >= 12);
    for (const x of r.results) {
      assert.equal(x.got, null);
      assert.equal(x.hit, false);
      assert.equal(x.superpowers, false);
    }
    assert.match(rf(out, 'utf8'), /\| category \| hits \| total \|/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('a failed launch or a transcript without init is an error, not a miss', () => {
  const c = { id: 'x', category: 'plan', lang: 'pt', expect: PW };
  const ok = parseTranscript(fx('no-skill.jsonl'));
  assert.equal(scoreCase(c, ok, { code: 0 }).error, undefined);
  const bad = scoreCase(c, ok, { code: 1 });
  assert.equal(bad.got, 'ERROR');
  assert.equal(bad.hit, false);
  assert.equal(bad.error, true);
  assert.equal(scoreCase(c, ok, { code: 0, error: 'spawn claude ENOENT' }).error, true);
  assert.equal(scoreCase(c, parseTranscript(''), { code: 0 }).error, true);
});

test('exit 1 from reaching --max-turns is scored, not an error', () => {
  const c = { id: 'x', category: 'plan', lang: 'pt', expect: PW };
  const maxTurns = JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true });
  const p = parseTranscript(`${fx('hit-superpowers-on.jsonl')}\n${maxTurns}\n`);
  assert.equal(p.result, 'error_max_turns');
  const s = scoreCase(c, p, { code: 1 });
  assert.equal(s.error, undefined);
  assert.equal(s.got, PW);
  assert.equal(s.hit, true);
  const other = JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true });
  assert.equal(scoreCase(c, parseTranscript(`${fx('hit-superpowers-on.jsonl')}\n${other}\n`), { code: 1 }).error, true);
});
