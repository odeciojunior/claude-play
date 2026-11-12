// E17 T8: the owner script (roteiro.md) and the ratification list (ratificacao.md) keep the contract of the spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SANDBOX_RELEASE_RULES } from './make-scenario.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '..', 'docs', 'reports', '2026-11-12-e17-ponto-de-medicao');
const read = (name) => readFileSync(join(dir, name), 'utf8').replace(/\r\n?/g, '\n');
const roteiro = read('roteiro.md');
const ratificacao = read('ratificacao.md');
const gates = read('gates.md');

const M = /SHA completa de `M`: `([0-9a-f]{40})`/.exec(gates)?.[1];
const section = (text, heading) => {
  const start = text.indexOf(heading);
  assert.notEqual(start, -1, `missing section ${heading}`);
  const next = text.indexOf('\n## ', start + heading.length);
  return text.slice(start, next === -1 ? undefined : next);
};
const PAID = '## Execuções pagas (orquestrador ou dono, fora do workflow)';
const PUBLISH = '## Publicação (somente o dono)';
const RATIFY = '## Ratificação';

test('E17 roteiro: measures in bypassPermissions pinned to M, never to the branch name', () => {
  assert.match(M ?? '', /^[0-9a-f]{40}$/, 'M must be read from gates.md');
  assert.match(roteiro, /--permission-mode bypassPermissions/);
  assert.match(roteiro, /--tag <SHA de M>/);
  assert.ok(roteiro.includes(M), 'the full SHA of M is recorded');
  assert.doesNotMatch(roteiro, /#feat\/E17/);
  assert.doesNotMatch(roteiro, /--tag feat\/E17/);
});

test('E17 roteiro: allows every sandbox rule', () => {
  assert.ok(SANDBOX_RELEASE_RULES.length >= 6);
  for (const rule of SANDBOX_RELEASE_RULES) {
    const quote = rule.includes('"') ? "'" : '"'; // a rule with a double quote needs single quotes in Git Bash
    assert.ok(roteiro.includes(`--allow ${quote}${rule}${quote}`), `missing --allow ${quote}${rule}${quote}`);
  }
});

test('E17 roteiro: seeds from the archived E15 run', () => {
  assert.match(roteiro, /semeadura-completo-1/);
  assert.match(roteiro, /7b9cc1394b2fb863ad04bf35af6c44cb8288c8a7f2e13f15fca1311601c36f93/);
  assert.match(roteiro, /ea14b7abf7197115e0bf2c6e20f3220e1aaaf11bc9cf40a4e552a0cdc4a74912/);
  assert.match(roteiro, /--from-run <árvore-da-semeadura>/);
});

test('E17 roteiro: throwaway config dir matches the E15 configuration', () => {
  const paid = section(roteiro, PAID);
  assert.match(paid, /cp [^\n]*CLAUDE\.md[^\n]*<config-dir>/);
  assert.match(paid, /cp [^\n]*settings\.json[^\n]*<config-dir>/);
  assert.match(paid, /credencia/);
  assert.match(paid, /fora do repositório e de qualquer worktree/);
  assert.match(paid, /diferença[^\n]*plugins/i);
  const logout = paid.search(/sai da conta/i);
  const remove = paid.search(/apaga a pasta/i);
  assert.ok(logout !== -1 && remove > logout, 'logout comes before removing the folder');
  assert.doesNotMatch(roteiro, /\.credentials/);
  assert.match(paid, /CLAUDE_CONFIG_DIR=<config-dir>/);
});

test('E17 roteiro: superpowers pinned to the E15 commit', () => {
  assert.match(roteiro, /bb92a77741419a4ab5f06e711a283343f1ada0c3/);
  assert.match(roteiro, /fixação não for aceita[^\n]*(pare|para|parar)[^\n]*registr/i);
});

test('E17 roteiro: tag is checked, not pushed', () => {
  assert.match(roteiro, /git ls-remote --tags origin productivity-tools--v1\.6\.0/);
  assert.match(roteiro, /productivity-tools--v1\.6\.0\^\{commit\}/);
  assert.doesNotMatch(roteiro, /git push origin productivity-tools--v1\.6\.0/);
});

test('E17 roteiro: publication steps are owner-only and in order', () => {
  const pub = section(roteiro, PUBLISH);
  const order = [
    'git rev-parse productivity-tools--v1.6.0^{commit}',
    'git ls-remote --tags origin productivity-tools--v1.6.0',
    'git push origin main',
    'claude plugin marketplace update claude-play',
    'claude plugin update productivity-tools@claude-play',
    'claude plugin update marketplace-tools@claude-play',
    '/reload-plugins',
    'cache/claude-play/productivity-tools/1.7.0/',
    'cache/claude-play/marketplace-tools/1.2.0/',
  ];
  let last = -1;
  for (const needle of order) {
    const at = pub.indexOf(needle, last + 1);
    assert.ok(at > last, `out of order or missing: ${needle}`);
    last = at;
  }
  assert.match(pub, /git rev-parse release\/roadmap-skills-v2:plugins\/productivity-tools/);
  assert.match(pub, /214fb3b50c164094e5eb1c6e18344d7b0bc62e3c/);
  assert.match(pub, /não força/i);
});

test('E17 roteiro: no personal path', () => {
  assert.doesNotMatch(roteiro, /[A-Za-z]:[\/]Users[\/]|\/home\//);
  assert.doesNotMatch(ratificacao, /[A-Za-z]:[\/]Users[\/]|\/home\//);
});

const PLAN_DECISIONS = 7;
test('E17 ratificacao: lists every autonomous decision with a recommended answer', () => {
  const rows = ratificacao.split('\n').filter((l) => l.startsWith('|'));
  for (let n = 1; n <= 12; n += 1) {
    const row = rows.find((l) => l.startsWith(`| spec ${n} |`));
    assert.ok(row, `missing row for spec decision ${n}`);
    assert.match(row, /DEC-\d{3}|sem id no alvo/);
    assert.match(row, /ratificar/);
  }
  for (let n = 1; n <= PLAN_DECISIONS; n += 1) {
    const row = rows.find((l) => l.startsWith(`| plano ${n} |`));
    assert.ok(row, `missing row for plan decision ${n}`);
    assert.match(row, /sem id no alvo/);
    assert.match(row, /ratificar/);
  }
  // every pending id recorded from the release tip has its own row with the recommended answer
  const json = /```json\n([\s\S]*?)\n```/.exec(ratificacao)?.[1];
  assert.ok(json, 'the pending-decisions output is recorded');
  const ids = JSON.parse(json).result.decisions.map((d) => d.id);
  assert.ok(ids.length > 0);
  for (const id of ids) {
    const row = rows.find((l) => l.startsWith(`| ${id} |`));
    assert.ok(row, `missing row for ${id}`);
    assert.match(row, /ratificar/);
  }
});

test('E17 ratificacao: generated from the release tip, never from feat/E17', () => {
  assert.match(ratificacao, /ponta de `release\/roadmap-skills-v2`[^\n]*`[0-9a-f]{40}`/);
  assert.match(ratificacao, /git archive release\/roadmap-skills-v2 docs\/plans\/2026-11-10-roadmap-evolucao-skills\.md docs\/plans\/roadmap-evolucao-skills/);
  assert.doesNotMatch(ratificacao, /pending-decisions docs\/plans\/roadmap-evolucao-skills/);
});

test('E17 roteiro: criterion 3 is checked on the release tip', () => {
  const sec = section(roteiro, RATIFY);
  assert.match(sec, /pending-decisions/);
  assert.match(sec, /release\/roadmap-skills-v2/);
  assert.match(sec, /SHA[^\n]*difere[^\n]*gerad[ao] de novo|difere[^\n]*gerad[ao] de novo/i);
  assert.match(sec, /--amend/);
});
