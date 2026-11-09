import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  validateReleaseConfig, deriveConfig, effectiveMaxParallel,
  requiredRules, requiredCommands, missingRules, quoteArg, parseGatesTable, runPreflight,
} from './preflight.mjs';

const good = () => ({
  projectContext: 'ctx',
  install: 'npm ci',
  gates: [{ name: 'lint', cmd: 'npm run lint', kind: 'exit' }, { name: 'unit', cmd: 'npm test', kind: 'tests', needsLock: 'db' }],
  locks: ['db'],
});

test('validateReleaseConfig accepts a valid config', () => {
  assert.deepEqual(validateReleaseConfig(good()), []);
});

test('validateReleaseConfig rejects invalid kind, empty gates, undeclared lock', () => {
  const a = good(); a.gates[0].kind = 'weird';
  assert.ok(validateReleaseConfig(a).some((e) => /kind/.test(e)));
  const b = good(); b.gates = [];
  assert.ok(validateReleaseConfig(b).some((e) => /gates/.test(e)));
  const c = good(); c.locks = [];
  assert.ok(validateReleaseConfig(c).some((e) => /lock/.test(e) && /db/.test(e)));
  assert.ok(validateReleaseConfig(null).length > 0);
});

test('validateReleaseConfig checks optional fields and duplicate gate names', () => {
  const a = good(); a.gates.push({ name: 'lint', cmd: 'x', kind: 'exit' });
  assert.ok(validateReleaseConfig(a).some((e) => /duplicate/.test(e)));
  const b = good(); b.gates[0].cmd = '';
  assert.ok(validateReleaseConfig(b).some((e) => /cmd/.test(e)));
});

test('parseGatesTable reads the roadmap:gates block', () => {
  const md = ['x', '<!-- roadmap:gates -->', '| ID | Command | Environment | When | Baseline |', '|---|---|---|---|---|',
    '| G1 | `npm run lint` | local | every task | green |', '| G2 | `npm test` | local | merge | 68 passing |', '<!-- /roadmap:gates -->'].join('\n');
  const rows = parseGatesTable(md);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].ID, 'G1');
  assert.equal(rows[1].Command, '`npm test`');
});

test('deriveConfig marks generated and classifies lint/build as exit, others tests', () => {
  const cfg = deriveConfig({
    gatesBlockRows: [
      { ID: 'G1', Command: '`npm run lint`' }, { ID: 'G2', Command: '`npm run build`' },
      { ID: 'G3', Command: '`npm test`' }, { ID: 'G4', Command: '`pytest -q`' },
    ],
    projectContext: 'rules',
  });
  assert.equal(cfg.generated, true);
  assert.equal(cfg.projectContext, 'rules');
  assert.deepEqual(cfg.gates.map((g) => g.kind), ['exit', 'exit', 'tests', 'tests']);
  assert.equal(cfg.gates[0].cmd, 'npm run lint');
  assert.deepEqual(validateReleaseConfig(cfg), []);
});

test('effectiveMaxParallel is 1 when generated', () => {
  assert.equal(effectiveMaxParallel({ generated: true }, 5), 1);
  assert.equal(effectiveMaxParallel({}, 5), 5);
  assert.equal(effectiveMaxParallel({}), 3);
  assert.equal(effectiveMaxParallel({ maxParallel: 2 }), 2);
  assert.equal(effectiveMaxParallel({}, 0), 1);
});

test('requiredRules covers gates, install, setup, beforeEvidence and git', () => {
  const cfg = {
    ...good(), install: 'pnpm install', setup: ['redis-server --daemonize yes'], beforeEvidence: 'make reset && make seed; echo ok',
  };
  const r = requiredRules(cfg);
  for (const x of ['Bash(npm:*)', 'Bash(pnpm:*)', 'Bash(redis-server:*)', 'Bash(make:*)', 'Bash(echo:*)', 'Bash(git:*)']) assert.ok(r.includes(x), x);
  assert.equal(new Set(r).size, r.length);
});

test('requiredRules splits && and ; and skips env assignments', () => {
  const r = requiredRules({ ...good(), install: 'FOO=1 yarn && cd x; npm ci' });
  assert.ok(r.includes('Bash(yarn:*)') && r.includes('Bash(cd:*)'));
});

const S = (...allow) => ({ permissions: { allow } });

test('missingRules understands wildcards across settings', () => {
  const req = ['Bash(npm:*)', 'Bash(git:*)', 'Bash(make:*)'];
  assert.deepEqual(missingRules(req, [S('Bash(npm:*)'), S('Bash(git:*)')]), ['Bash(make:*)']);
  assert.deepEqual(missingRules(req, [S('Bash(*)')]), []);
  assert.deepEqual(missingRules(req, [S('Bash')]), []);
  assert.deepEqual(missingRules(req, [{}, null, undefined]), req);
});

test('missingRules accepts exact-command allows when commands are given', () => {
  const cmds = { 'Bash(npm:*)': ['npm run lint'] };
  assert.deepEqual(missingRules(['Bash(npm:*)'], [S('Bash(npm run lint)')], cmds), []);
  assert.deepEqual(missingRules(['Bash(npm:*)'], [S('Bash(npm run build)')], cmds), ['Bash(npm:*)']);
  assert.deepEqual(missingRules(['Bash(npm:*)'], [S('Bash(npm run:*)')], cmds), []);
  assert.deepEqual(missingRules(['Bash(npm:*)'], [S('Bash(npm run lint)')]), ['Bash(npm:*)']);
});

test('requiredCommands maps rules to commands', () => {
  const m = requiredCommands(good());
  assert.ok(m['Bash(npm:*)'].includes('npm run lint'));
  assert.ok(m['Bash(git:*)']);
});

test('quoteArg quotes paths with spaces and escapes quotes', () => {
  assert.equal(quoteArg('D:/a b/c'), '"D:/a b/c"');
  assert.equal(quoteArg('a"b'), '"a\\"b"');
  assert.equal(quoteArg('x$y'), '"x\\$y"');
});

const rulesFor = (install) => requiredRules({ ...good(), install });

test('requiredRules treats a newline as a separator', () => {
  assert.ok(rulesFor('make a\nrm -rf x').includes('Bash(rm:*)'));
});

test('requiredRules treats single & and |& as separators and strips subshell parens', () => {
  const r = rulesFor('(cd x && npm t) & curl y');
  assert.ok(r.includes('Bash(curl:*)') && r.includes('Bash(cd:*)'));
  assert.ok(!r.some((x) => x.startsWith('Bash((')));
  assert.ok(rulesFor('a |& tee b').includes('Bash(tee:*)'));
});

test('requiredRules extracts $() and backtick substitutions', () => {
  assert.ok(rulesFor('echo $(whoami)').includes('Bash(whoami:*)'));
  assert.ok(rulesFor('echo `hostname`').includes('Bash(hostname:*)'));
  assert.ok(rulesFor('echo "x $(id -u)"').includes('Bash(id:*)'));
});

test('requiredRules respects quotes and redirects', () => {
  const r = rulesFor('bash -c "a && b; c" && echo \'x | y\' 2>&1');
  assert.deepEqual(r.filter((x) => x !== 'Bash(npm:*)' && x !== 'Bash(git:*)').sort(), ['Bash(bash:*)', 'Bash(echo:*)']);
});

test('validateReleaseConfig rejects the reserved lock name merge', () => {
  const a = good(); a.locks = ['db', 'merge'];
  assert.ok(validateReleaseConfig(a).some((e) => /merge/.test(e) && /reserved/.test(e)));
  const b = good(); b.locks = ['db', 'merge']; b.gates[1].needsLock = ['merge'];
  assert.ok(validateReleaseConfig(b).some((e) => /needsLock/.test(e) && /reserved/.test(e)));
});

test('missingRules accepts the space-star wildcard form', () => {
  const cmds = { 'Bash(npm:*)': ['npm run lint'], 'Bash(git:*)': [] };
  const req = Object.keys(cmds);
  assert.deepEqual(missingRules(req, [{ permissions: { allow: ['Bash(git *)', 'Bash(npm run *)'] } }], cmds), []);
  assert.deepEqual(missingRules(req, [{ permissions: { allow: ['Bash(git:*)'] } }], cmds), ['Bash(npm:*)']);
});

function repoWithRoadmap(releaseCfgOnRef) {
  const root = mkdtempSync(join(tmpdir(), 'pf-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=a@b', '-c', 'user.name=t', ...a], { cwd: root, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  const dir = join(root, 'docs', 'plans', 'roadmap-x');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'roadmap.config.json'), JSON.stringify({ strategy: 's.md' }));
  writeFileSync(join(dir, 's.md'), '<!-- roadmap:gates -->\n| ID | Command | Environment | When | Baseline |\n|---|---|---|---|---|\n| g1 | npm run lint | - | always | green |\n<!-- /roadmap:gates -->\n');
  git('add', '.'); git('commit', '-qm', 'init');
  git('branch', 'rel');
  if (releaseCfgOnRef) {
    git('checkout', '-q', 'rel');
    writeFileSync(join(dir, 'release.config.json'), JSON.stringify({ ...good(), generated: false }));
    git('add', '.'); git('commit', '-qm', 'cfg');
    git('checkout', '-q', 'main');
  }
  return { root, dir };
}

test('runPreflight --ref uses the reviewed config on the ref instead of regenerating', () => {
  const { dir } = repoWithRoadmap(true);
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const withRef = runPreflight(dir, { home, ref: 'rel' });
  assert.equal(withRef.generated, false);
  assert.equal(withRef.config.install, 'npm ci');
  assert.deepEqual(withRef.errors, []);
  const noRef = runPreflight(dir, { home });
  assert.equal(noRef.generated, true);
});

test('runPreflight --ref falls back to regeneration when the ref has no config', () => {
  const { dir } = repoWithRoadmap(false);
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  assert.equal(runPreflight(dir, { home, ref: 'rel' }).generated, true);
  assert.equal(runPreflight(dir, { home, ref: 'no-such-branch' }).generated, true);
});

test('runPreflight reads settings from CLAUDE_CONFIG_DIR when given', () => {
  const { dir } = repoWithRoadmap(true);
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const cfgDir = mkdtempSync(join(tmpdir(), 'cc-'));
  writeFileSync(join(cfgDir, 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash'] } }));
  assert.deepEqual(runPreflight(dir, { home, ref: 'rel', configDir: cfgDir }).missingRules, []);
  assert.ok(runPreflight(dir, { home, ref: 'rel' }).missingRules.length > 0);
});
