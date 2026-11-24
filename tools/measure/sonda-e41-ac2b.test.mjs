import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { joinSlices } from '../../plugins/productivity-tools/lib/plan-digest.mjs';
import { PROSE_NOTE, PROSE_HANDOFF } from './sonda-e41-ac2b.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const plugin = path.join(repo, 'plugins', 'productivity-tools');
const tool = path.join(here, 'sonda-e41-ac2b.mjs');
const progress = path.join(plugin, 'skills', 'plan-coordinator', 'scripts', 'progress.mjs');
const roteiro = fs.readFileSync(path.join(here, 'sonda-e41-ac2b.md'), 'utf8');

const node = (args) => spawnSync(process.execPath, args, { encoding: 'utf8' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sonda-'));
const SID = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('prepare builds the sandbox and stops at authorize', () => {
  const work = tmp();
  try {
    const r = node([tool, 'prepare', '--work', work, '--plugin', plugin]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /nextAction: authorize/);
    const dir = path.join(work, 'sandbox', 'docs', 'plans', 'sonda');
    assert.match(fs.readFileSync(path.join(dir, 'spec.md'), 'utf8'), /"spec\/1"/);
    const plan = fs.readFileSync(path.join(dir, 'plan.md'), 'utf8');
    assert.match(plan, /"plan\/1"/);
    assert.equal((plan.match(/"externalDedupe": "/g) ?? []).length, 1);
    assert.equal(spawnSync('git', ['rev-parse', '--git-dir'], { cwd: path.join(work, 'sandbox') }).status, 0);
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'progress.json'), 'utf8'));
    assert.equal(state.steps.length, 40);
    assert.equal(state.steps[0].external, true);
    assert.equal(state.steps[0].preLaunchReview, 'pass');
    const s0 = node([progress, 'read', path.join(dir, 'progress.json'), '--nonce', 'abc', '--slice', '0']);
    assert.equal(s0.status, 0, s0.stderr);
    assert.ok(JSON.parse(s0.stdout).slices >= 2);
    assert.equal(state.steps[8].note, PROSE_NOTE);
    assert.equal(state.steps[8].handoff, PROSE_HANDOFF);
    const n = JSON.parse(s0.stdout).slices;
    const envs = [];
    for (let k = 0; k < n; k++) envs.push(JSON.parse(node([progress, 'read', path.join(dir, 'progress.json'), '--nonce', 'abc', '--slice', String(k)]).stdout));
    const joined = joinSlices(envs);
    assert.equal(joined.ok, true);
    assert.equal(JSON.parse(joined.text).state.steps[8].handoff, PROSE_HANDOFF);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

test('prepare refuses a work dir inside the repository', () => {
  const r = node([tool, 'prepare', '--work', path.join(repo, 'tools', 'measure', 'out', 'sonda-x'), '--plugin', plugin]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dentro do repositorio/);
});

function fakeRuns(work, { cost = 0.1, miss = null, noAuthorize = null } = {}) {
  fs.mkdirSync(path.join(work, 'runs'), { recursive: true });
  let i = 0;
  for (const mode of ['on', 'off']) {
    for (const k of [1, 2, 3]) {
      i++;
      if (miss === k + '-' + mode) continue;
      const out = { type: 'result', is_error: false, result: noAuthorize === k + '-' + mode ? 'falhou na leitura' : 'parada em authorize para T1', session_id: SID(i), total_cost_usd: cost };
      fs.writeFileSync(path.join(work, 'runs', k + '-' + mode + '.json'), JSON.stringify(out));
    }
  }
}

function fakeRetry(cfg) {
  const dir = path.join(cfg, 'projects', 'p');
  const sub = path.join(dir, SID(1), 'subagents', 'workflows', 'wf_x');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(dir, SID(1) + '.jsonl'), '');
  fs.writeFileSync(path.join(sub, 'agent-afab1.jsonl'), '');
  fs.writeFileSync(path.join(sub, 'agent-afab1.meta.json'), JSON.stringify({ description: 'e1:read-slice1-retry2' }));
}

test('summarize prints the table row and exits 0 for 6 runs at authorize within US$ 1', () => {
  const work = tmp();
  const cfg = tmp();
  try {
    fakeRuns(work);
    fakeRetry(cfg);
    const r = node([tool, 'summarize', '--work', work, '--config', cfg]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^\| E41 AC2b \| 6 execucoes \| parada authorize em 6\/6 \| retries de fatia 1 \| custo US\$ 0\.6000 \|/);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    fs.rmSync(cfg, { recursive: true, force: true });
  }
});

test('summarize exits 1 on a failed run or a sum above US$ 1', () => {
  const work = tmp();
  const cfg = tmp();
  try {
    fakeRuns(work, { miss: '2-off' });
    assert.equal(node([tool, 'summarize', '--work', work, '--config', cfg]).status, 1);
    fakeRuns(work, { miss: null, noAuthorize: '1-on' });
    assert.equal(node([tool, 'summarize', '--work', work, '--config', cfg]).status, 1);
    fakeRuns(work, { cost: 0.2 });
    const r = node([tool, 'summarize', '--work', work, '--config', cfg]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /custo somado/);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    fs.rmSync(cfg, { recursive: true, force: true });
  }
});

test('summarize adds aborted runs to the cost without counting them as runs', () => {
  const work = tmp();
  const cfg = tmp();
  try {
    fakeRuns(work);
    fs.writeFileSync(path.join(work, 'runs', 'abortada-1-on-sonnet.json'), JSON.stringify({ is_error: true, total_cost_usd: 0.170395 }));
    let r = node([tool, 'summarize', '--work', work, '--config', cfg]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\| 6 execucoes \| parada authorize em 6\/6 \|.*custo US\$ 0\.7704 \|/);
    fs.writeFileSync(path.join(work, 'runs', 'abortada-2.json'), JSON.stringify({ is_error: true, total_cost_usd: 0.3 }));
    r = node([tool, 'summarize', '--work', work, '--config', cfg]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /custo somado/);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    fs.rmSync(cfg, { recursive: true, force: true });
  }
});

test('the script has 3 runs with context-mode on and 3 off, with budget, config and plugin-dir', () => {
  const cmds = roteiro.split('\n').filter((l) => /^CLAUDE_CONFIG_DIR=.*--max-budget-usd 0\.13.*runs\/[123]-(on|off)\.json$/.test(l));
  assert.equal(cmds.length, 6);
  assert.equal((roteiro.match(/<k>-on\.json|[123]-on\.json/g) ?? []).length >= 3, true);
  assert.equal((roteiro.match(/[123]-off\.json/g) ?? []).length >= 3, true);
  assert.match(roteiro, /CLAUDE_CONFIG_DIR=/);
  assert.match(roteiro, /--plugin-dir/);
  assert.match(roteiro, /fora do reposit/);
  assert.match(roteiro, /context-mode/);
  assert.match(roteiro, /(s[óo]|somente) .*CLAUDE_CONFIG_DIR/);
  assert.match(roteiro, /measurements\.md/);
  assert.match(roteiro, /roadmap-tracker/);
  for (const id of ['X1', 'X2', 'H1', 'H2']) assert.match(roteiro, new RegExp('\\b' + id + '\\b'));
  assert.match(roteiro, /autoriza/);
});
