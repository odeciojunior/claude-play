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
  assert.deepEqual(a, ['-p', prompt, '--plugin-dir', 'plugins/productivity-tools', '--output-format', 'stream-json', '--verbose', '--max-turns', '3']);
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
    assert.match(l, /--max-turns 3/);
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

// ---- E20: casos com caminhos válidos e sandbox por caso ----
import { existsSync, readdirSync, readFileSync as rfs2 } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { citedPaths, sandboxFiles, seedSandbox } from './run-trigger.mjs';
import { writeFile as wf, mkdir as mk } from 'node:fs/promises';
import { dirname as dn, resolve as rsv } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dn(fileURLToPath(import.meta.url));
const caseList = () => JSON.parse(rf(CASES_FILE, 'utf8')).cases;
const writer = async (p, data) => { await mk(dn(p), { recursive: true }); await wf(p, data); };
function listAll(dir, prefix = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listAll(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out.sort();
}
async function seed(c) {
  const tmp = mkdtempSync(join(tmpdir(), 'trigger-seed-'));
  await seedSandbox(tmp, writer, c.fixtures ?? []);
  return tmp;
}

test('per case: every cited path exists in that sandbox and nothing else is there', async () => {
  for (const c of caseList()) {
    const tmp = await seed(c);
    try {
      assert.deepEqual(listAll(tmp), [...(c.fixtures ?? [])].sort(), `${c.id} sandbox holds exactly its fixtures`);
      for (const p of citedPaths([c])) {
        assert.ok(existsSync(join(tmp, ...p.split('/'))), `${c.id} cites ${p} but it is missing`);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test('every fixture file is used by at least one case', async () => {
  const used = new Set(caseList().flatMap((c) => c.fixtures ?? []));
  assert.deepEqual([...used].sort(), await sandboxFiles());
});

test('no case sees the output of its expected skill or another skill artifacts', () => {
  for (const c of caseList()) {
    const fx = c.fixtures ?? [];
    const cites = citedPaths([c]);
    const has = (re) => fx.some((p) => re.test(p));
    if (c.id !== 'spec-3') assert.equal(has(/roadmap-text-utilities\//), false, `${c.id} roadmap folder`);
    if (c.id !== 'plan-execution-2') assert.equal(has(/progress\.json$/), false, `${c.id} progress.json`);
    if (c.expect.endsWith(':spec-writer')) assert.equal(has(/spec\.md$/), false, `${c.id} spec.md`);
    if (c.expect.endsWith(':plan-writer')) assert.equal(has(/text-utilities\/plan\.md$/), false, `${c.id} plan/1`);
    if (c.expect.endsWith(':roadmap-planner')) assert.deepEqual(fx, [], `${c.id} fixtures`);
    for (const p of fx) {
      const needed = cites.includes(p)
        || (c.category === 'plan-execution' && /text-utilities\/(spec\.md|progress\.json|plan\.md)$/.test(p))
        || (c.id === 'spec-3' && /roadmap-text-utilities\//.test(p))
        || (c.id === 'plan-2' && /word-count\/spec\.md$/.test(p));
      assert.ok(needed, `${c.id} seeds unjustified ${p}`);
    }
  }
});

test('roadmap cases get no roadmap.config.json unless they cite one', async () => {
  for (const c of caseList().filter((x) => x.category === 'roadmap')) {
    const tmp = await seed(c);
    try {
      const found = listAll(tmp).filter((p) => p.endsWith('roadmap.config.json'));
      const cited = citedPaths([c]).filter((p) => p.endsWith('roadmap.config.json'));
      assert.deepEqual(found, cited, c.id);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test('the fixture plan has a data block and the fixture state is not stale against it', async () => {
  const c = caseList().find((x) => x.id === 'plan-execution-2');
  const tmp = await seed(c);
  try {
    const plan = join(tmp, 'docs', 'plans', 'text-utilities', 'plan.md');
    assert.match(rfs2(plan, 'utf8'), /```json data\n/);
    spawnSync('git', ['init', '-q'], { cwd: tmp });
    const prog = rsv(HERE, '..', '..', 'plugins', 'productivity-tools', 'skills', 'plan-coordinator', 'scripts', 'progress.mjs');
    const state = join(tmp, 'docs', 'plans', 'text-utilities', 'progress.json');
    const r = spawnSync(process.execPath, [prog, 'next', state, '--json'], { cwd: tmp, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.notEqual(JSON.parse(r.stdout).action.action, 'plan-changed');
    const tool = rsv(HERE, '..', '..', 'plugins', 'productivity-tools', 'scripts', 'plan-tool.mjs');
    const chk = spawnSync(process.execPath, [tool, 'check', plan], { encoding: 'utf8' });
    assert.equal(chk.status, 0, chk.stdout + chk.stderr);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('citedPaths finds docs/ paths, ./docs and backslash paths, and only those', () => {
  const one = (t) => [{ prompt: { pt: t } }];
  assert.deepEqual(citedPaths(one('veja docs/plans/a/plan.md.')), ['docs/plans/a/plan.md']);
  assert.deepEqual(citedPaths(one('veja ./docs/plans/a/plan.md')), ['docs/plans/a/plan.md']);
  assert.deepEqual(citedPaths(one('veja docs\\plans\\a\\plan.md')), ['docs/plans/a/plan.md']);
  assert.deepEqual(citedPaths(one('veja src/x.mjs e README.md')), []);
});

test('run seeds only the case fixtures before launching claude', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'trigger-run-'));
  try {
    const seen = {};
    await runTrigger(
      { casesFile: CASES_FILE, pluginDir: 'p', work: join(tmp, 'work'), out: join(tmp, 'o.md'), lang: 'pt', only: ['plan-execution-1', 'roadmap-1'] },
      {
        spawn: async (cmd, _a, { cwd }) => {
          if (cmd === 'claude') seen[cwd.split(/[\\/]/).pop().split('-pt-')[0]] = listAll(cwd).filter((p) => !p.startsWith('.git/'));
          return { stdout: fx('no-skill.jsonl'), code: 0 };
        },
        log: () => {},
      },
    );
    assert.deepEqual(seen['plan-execution-1'], ['docs/plans/text-utilities/plan.md', 'docs/plans/text-utilities/spec.md']);
    assert.deepEqual(seen['roadmap-1'], []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('--max-turns is 3', () => {
  const a = buildArgs('x', { pluginDir: 'p' });
  assert.equal(a[a.indexOf('--max-turns') + 1], '3');
});

test('plan-execution-1 cites docs/plans/text-utilities/plan.md in both languages', () => {
  const c = caseList().find((x) => x.id === 'plan-execution-1');
  for (const l of ['pt', 'en']) {
    assert.match(c.prompt[l], /docs\/plans\/text-utilities\/plan\.md/);
    assert.doesNotMatch(c.prompt[l], /docs\/superpowers/);
  }
});
