import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  validateReleaseConfig, deriveConfig, classifyGate,
  requiredRules, requiredCommands, missingRules, parseGatesTable, runPreflight,
} from './preflight.mjs';
import { readBlocks, parseTable } from '../../roadmap-tracker/scripts/check-roadmap.mjs';

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

const HEAD = ['| ID | Comando | Ambiente | Quando | Linha de base |', '|:--|---|---|---|---|'];
const gatesMd = (rows, open = '<!-- roadmap:gates -->') => [open, ...HEAD, ...rows, '<!-- /roadmap:gates -->'].join('\n');
const ROW1 = '| G1 | `npm test \\| tee out.txt` | local | cada tarefa | verde |';

test('item 3: columns are read by position, whatever the header words say', () => {
  const rows = parseGatesTable(gatesMd([ROW1]));
  assert.equal(rows[0].ID, 'G1');
  assert.equal(rows[0].When, 'cada tarefa');
  assert.equal(deriveConfig({ gatesBlockRows: rows }).gates[0].cmd, 'npm test | tee out.txt');
});

test('item 3: an anchor with attributes opens the block', () => {
  const rows = parseGatesTable(gatesMd([ROW1], '<!-- roadmap:gates v=2 -->'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ID, 'G1');
  assert.equal(rows[0].When, 'cada tarefa');
});

test('item 3: a gates block inside a code fence before the real one is ignored', () => {
  const fenced = ['```md', gatesMd(['| G9 | `echo no` | local | x | y |']), '```'].join('\n');
  const rows = parseGatesTable(`${fenced}\n\n${gatesMd([ROW1])}`);
  assert.deepEqual(rows.map((r) => r.ID), ['G1']);
});

test('item 3: rows with an empty, "-" or "—" command are dropped', () => {
  const rows = parseGatesTable(gatesMd([ROW1, '| G2 |  | local | x | y |', '| G3 | - | local | x | y |', '| G4 | — | local | x | y |']));
  assert.deepEqual(rows.map((r) => r.ID), ['G1']);
});

test('item 3: parity with the checker', () => {
  const md = ['```', gatesMd(['| G9 | `x` | l | w | b |']), '```', gatesMd([ROW1, '| G2 | `make a` | local | merge | ok |', '| G3 | - | local | x | y |'])].join('\n');
  const rows = parseGatesTable(md);
  const checker = parseTable(readBlocks(md, 'gates')[0].body).map((r) => r[1]).filter((c) => c && c !== '-' && c !== '—');
  assert.deepEqual(checker, rows.map((r) => r.Command));
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
  assert.deepEqual(r.filter((x) => x !== 'Bash(npm:*)' && x !== 'Bash(git:*)' && x !== 'Bash(node:*)').sort(), ['Bash(bash:*)', 'Bash(echo:*)']);
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

function repoWithRoadmap(releaseCfgOnRef, gateRows = '| g1 | npm run lint | - | always | green |\n') {
  const root = mkdtempSync(join(tmpdir(), 'pf-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=a@b', '-c', 'user.name=t', ...a], { cwd: root, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  const dir = join(root, 'docs', 'plans', 'roadmap-x');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'roadmap.config.json'), JSON.stringify({ strategy: 's.md' }));
  writeFileSync(join(dir, 's.md'), '<!-- roadmap:gates -->\n| ID | Command | Environment | When | Baseline |\n|---|---|---|---|---|\n' + gateRows + '<!-- /roadmap:gates -->\n');
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

test('I4: Bash(node:*) is always required, and a narrower node rule does not cover it', () => {
  assert.ok(requiredRules(good()).includes('Bash(node:*)'));
  const cfg = { ...good(), gates: [{ name: 'u', cmd: 'node --test', kind: 'tests' }] };
  const cmds = requiredCommands(cfg);
  const S = { permissions: { allow: ['Bash(node --test:*)', 'Bash(git:*)', 'Bash(npm:*)'] } };
  assert.deepEqual(missingRules(Object.keys(cmds), [S], cmds), ['Bash(node:*)']);
});

test('I5: derived gates default to exit unless the command names a test runner', () => {
  const kinds = (list) => deriveConfig({ gatesBlockRows: list.map((c, i) => ({ ID: 'G' + i, Command: c })) }).gates.map((g) => g.kind);
  assert.deepEqual(kinds(['npx eslint .', 'tsc --noEmit', 'npm run typecheck', 'prettier --check .']), ['exit', 'exit', 'exit', 'exit']);
  assert.deepEqual(kinds(['npm test', 'npm run test:unit', 'npx vitest run', 'pytest -q', 'node --test', 'go test ./...', 'cargo test', 'make test']), Array(8).fill('tests'));
});

test('I5: a derived config detects the lockfile for install, or warns about the missing install', () => {
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const bare = repoWithRoadmap(false);
  const none = runPreflight(bare.dir, { home });
  assert.equal(none.config.install, '');
  assert.ok(none.warnings.some((w) => /install/.test(w)));
  const locked = repoWithRoadmap(false);
  writeFileSync(join(locked.root, 'package-lock.json'), '{}');
  const npm = runPreflight(locked.dir, { home });
  assert.equal(npm.config.install, 'npm ci');
  assert.deepEqual(npm.warnings, []);
  const reviewed = repoWithRoadmap(true);
  assert.deepEqual(runPreflight(reviewed.dir, { home, ref: 'rel' }).warnings, []);
});

test('m4: the helpers unused by the workflow are gone', async () => {
  const mod = await import('./preflight.mjs');
  assert.equal(mod.quoteArg, undefined);
  assert.equal(mod.effectiveMaxParallel, undefined);
});

test('item 4: classifyGate', () => {
  for (const [e, w] of [['local', 'every task'], ['', '-'], ['-', '—'], ['local', 'before merge'], ['', 'cada tarefa']]) assert.equal(classifyGate(e, w), 'free', `${e}|${w}`);
  for (const [e, w] of [['prod', 'every task'], ['Produção', 'before merge'], ['staging', ''], ['owner laptop', 'merge'], ['Release only', '']]) assert.equal(classifyGate(e, w), 'restricted', `${e}|${w}`);
  for (const [e, w] of [['kubernetes cluster', 'nightly'], ['CI runner', ''], ['kubernetes cluster', 'every task'], ['local', 'nightly']]) assert.equal(classifyGate(e, w), 'unknown', `${e}|${w}`);
});

test('item 4: always and sempre are free', () => {
  assert.equal(classifyGate('', 'always'), 'free');
  assert.equal(classifyGate('local', 'sempre'), 'free');
  assert.equal(classifyGate('prod', 'always'), 'restricted');
});

test('item 4: deriveConfig keeps restricted gates in the config with restricted: true and warns on unknown', () => {
  const warnings = [];
  const cfg = deriveConfig({
    gatesBlockRows: [
      { ID: 'G1', Command: 'npm run lint', Environment: 'local', When: 'every task' },
      { ID: 'G2', Command: 'npm run e2e', Environment: 'prod', When: 'before merge' },
      { ID: 'G3', Command: 'kubectl get pods', Environment: 'kubernetes cluster', When: 'nightly' },
    ],
    warnings,
  });
  assert.deepEqual(cfg.gates.map((g) => g.restricted === true), [false, true, true]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /G3/);
});

test('the all-restricted error gives a fix that works: both cells of one gate, with no restriction mark left', () => {
  const cfg = good(); cfg.gates.forEach((g) => { g.restricted = true; });
  const e = validateReleaseConfig(cfg).find((x) => /every gate is restricted/.test(x));
  assert.match(e, /both its Environment and When cells/);
  assert.match(e, /no restriction mark/);
  assert.equal(classifyGate('local', 'every task'), 'free');
  assert.equal(classifyGate('local', ''), 'free');
  assert.equal(classifyGate('prod local', 'every'), 'restricted');
});

test('item 4: a config where every gate is restricted is an error', () => {
  const cfg = good(); cfg.gates.forEach((g) => { g.restricted = true; });
  assert.ok(validateReleaseConfig(cfg).some((e) => /every gate is restricted/.test(e) && !/without authorization/.test(e)));
  const one = good(); one.gates[0].restricted = true;
  assert.deepEqual(validateReleaseConfig(one), []);
  const bad = good(); bad.gates[0].restricted = 'yes';
  assert.ok(validateReleaseConfig(bad).some((e) => /restricted must be a boolean/.test(e)));
});

test('item 4: runPreflight on a roadmap with a free and a restricted gate returns both, the restricted one flagged, and no error', () => {
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const mixed = repoWithRoadmap(false, '| g1 | npm run lint | local | every task | green |\n| g2 | npm run e2e | prod | before merge | green |\n');
  const r = runPreflight(mixed.dir, { home });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.config.gates.map((g) => [g.name, g.restricted === true]), [['g1', false], ['g2', true]]);
  const all = repoWithRoadmap(false, '| g1 | npm run lint | prod | every task | green |\n| g2 | npm run e2e | staging | before merge | green |\n');
  assert.ok(runPreflight(all.dir, { home }).errors.some((e) => /every gate is restricted/.test(e)));
});

test('item 4: a restricted gate needs no permission rule until authorized', () => {
  const cfg = { ...good(), gates: [{ name: 'a', cmd: 'npm test', kind: 'tests' }, { name: 'k', cmd: 'kubectl apply', kind: 'exit', restricted: true }], locks: [] };
  assert.ok(!requiredRules(cfg).includes('Bash(kubectl:*)'));
  assert.ok(requiredRules(cfg).includes('Bash(npm:*)'));
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const repo = repoWithRoadmap(false, '| a | npm test | local | every task | green |\n| k | kubectl apply | prod | before merge | green |\n');
  const r = runPreflight(repo.dir, { home });
  assert.ok(r.warnings.some((w) => /\bk\b/.test(w) && /Bash\(kubectl:\*\)/.test(w)));
  assert.ok(!r.missingRules.includes('Bash(kubectl:*)'));
});

test('minor 5: validateReleaseConfig rejects a restricted gate name with a space', () => {
  const c = good(); c.gates[0].name = 'my gate'; c.gates[0].restricted = true;
  assert.ok(validateReleaseConfig(c).some((e) => /name/.test(e) && /space/i.test(e)));
});

test('B re-review minor 4: a space in the name is rejected only for a restricted gate', () => {
  const c = good(); c.gates[0].name = 'unit tests';
  assert.deepEqual(validateReleaseConfig(c), []);
  c.gates[0].restricted = true;
  assert.ok(validateReleaseConfig(c).some((e) => /space/i.test(e)));
});

test('B ledger: prod restricts "prod", "production" and "produção", not "product"', () => {
  for (const [e, w] of [['prod', ''], ['Production', 'merge'], ['produção', ''], ['eu-prod', ''], ['', 'on prod.']]) assert.equal(classifyGate(e, w), 'restricted', `${e}|${w}`);
  for (const [e, w] of [['product', 'merge'], ['', 'product release']]) assert.notEqual(classifyGate(e, w), 'restricted', `${e}|${w}`);
});

test('B ledger: gate opener and closer follow the checker comment scan (malformed opener, trailing text)', () => {
  const cases = [
    ['<!-- roadmap:gates', ...HEAD, '<!-- note -->', '| ID | Command | Environment | When | Baseline |', ROW1, '<!-- /roadmap:gates -->'].join('\n'),
    [ '<!-- roadmap:gates -->', ...HEAD, ROW1, '<!-- /roadmap:gates extra -->', '<!-- /roadmap:gates -->'].join('\n'),
    [ '<!-- roadmap:gates -->', ...HEAD, ROW1, '<!-- /roadmap:gates', '<!-- /roadmap:gates -->'].join('\n'),
    [ '<!--roadmap:gates-->', ...HEAD, ROW1, '<!--/roadmap:gates-->'].join('\n'),
    [ '<!-- roadmap:gatesx -->', ...HEAD, ROW1, '<!-- /roadmap:gates -->'].join('\n'),
    gatesMd([ROW1]),
  ];
  for (const md of cases) {
    const b = readBlocks(md, 'gates')[0];
    const expected = b ? parseTable(b.body).filter((r) => r.length === 5 && !['', '-', '—'].includes(r[1])).map((r) => r[0]) : [];
    assert.deepEqual(parseGatesTable(md).map((r) => r.ID), expected, md);
  }
});

test('B ledger: a row with the wrong number of columns is skipped with a warning', () => {
  const warnings = [];
  const rows = parseGatesTable(gatesMd([ROW1, '| G2 | `npm run lint` | local |', '| G3 | `a | b` | local | merge | ok |']), warnings);
  assert.deepEqual(rows.map((r) => r.ID), ['G1']);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every((w) => /expected 5/.test(w)));
  assert.ok(/G2/.test(warnings[0]) && /G3/.test(warnings[1]));
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const repo = repoWithRoadmap(false, '| g1 | npm run lint | local | always | green |\n| g2 | npm test |\n');
  assert.ok(runPreflight(repo.dir, { home }).warnings.some((w) => /g2/.test(w) && /expected 5/.test(w)));
});

test('minor 4: the warning of an unknown cell names the fix available before any config file exists', () => {
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const repo = repoWithRoadmap(false, '| a | npm test | ci | dev | green |\n');
  const w = runPreflight(repo.dir, { home }).warnings.filter((x) => /gate a\b/.test(x));
  assert.ok(w.some((x) => /gates table/.test(x) && /local/.test(x)), JSON.stringify(w));
});

test('B ledger: an unknown derived gate yields one warning, with the rule to add', () => {
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const repo = repoWithRoadmap(false, '| a | npm test | local | every task | green |\n| k | kubectl diff | lab | whenever | green |\n');
  const w = runPreflight(repo.dir, { home }).warnings.filter((x) => /gate k\b/.test(x));
  assert.equal(w.length, 1);
  assert.ok(/not recognized/.test(w[0]) && /Bash\(kubectl:\*\)/.test(w[0]) && /gate:k/.test(w[0]));
});

test('B fix 1: the prod family fails toward restricted, NFC-normalized; only real other words are free', () => {
  const nfd = 'produção'.normalize('NFD');
  for (const [e, w] of [['local e ' + nfd, 'merge'], ['local produções', 'merge'], ['prods', ''], ['producoes', 'every task'], ['local', 'produção'.normalize('NFD')], ['proddb', ''], ['PRODUCAO', '']]) assert.equal(classifyGate(e, w), 'restricted', `${e}|${w}`);
  for (const [e, w] of [['product', 'merge'], ['local products', 'merge'], ['local', 'produto'], ['productivity', 'every'], ['local', 'producer']]) assert.notEqual(classifyGate(e, w), 'restricted', `${e}|${w}`);
});

test('B fix 1: a duplicate name is flagged even when a restricted name has a space', () => {
  const c = good(); c.gates[0].name = 'my gate'; c.gates[0].restricted = true; c.gates[1].name = 'my gate';
  assert.ok(validateReleaseConfig(c).some((e) => /duplicate/.test(e)));
});

test('B fix 1: a bare pipe line gives no column warning; parity also holds with CRLF, fences and nested openers', () => {
  const w = [];
  assert.deepEqual(parseGatesTable(gatesMd([ROW1, '|']), w).map((r) => r.ID), ['G1']);
  assert.deepEqual(w, []);
  const cases = [
    gatesMd([ROW1, '| G2 | `make a` | local | merge | ok |']).replace(/\n/g, '\r\n'),
    ['```', '<!-- roadmap:gates -->', '```', gatesMd([ROW1, '| G2 | `make a` | l | w | b |'])].join('\n'),
    ['<!-- roadmap:gates <!-- roadmap:gates -->', ...HEAD, ROW1, '| G2 | `make a` | l | w | b |', '<!-- /roadmap:gates -->'].join('\n'),
    ['~~~~', gatesMd([ROW1]), '~~~', gatesMd(['| G2 | `make a` | l | w | b |', '| G3 | `x` | l | w | b |']), '~~~~'].join('\n'),
  ];
  for (const md of cases) {
    const b = readBlocks(md, 'gates')[0];
    const expected = b ? parseTable(b.body).filter((r) => r.length === 5 && !['', '-', '—'].includes(r[1])).map((r) => r[0]) : [];
    assert.deepEqual(parseGatesTable(md).map((r) => r.ID), expected, md);
  }
});

test('L3-B: the unknown-cell warning names the cell to change (Environment, When, or both)', () => {
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const rows = '| a | npm test | ci | every task | green |\n| b | npm test | local | whenever | green |\n| c | npm test | ci | whenever | green |\n| d | npm test | local | dev | green |\n';
  const repo = repoWithRoadmap(false, rows);
  const w = runPreflight(repo.dir, { home }).warnings;
  const of = (n) => w.find((x) => x.startsWith(`gate ${n}:`));
  assert.match(of('a'), /write local in the Environment cell/);
  assert.match(of('b'), /write local in the When cell/);
  assert.match(of('c'), /write local in both the Environment and When cells/);
  assert.match(of('d'), /write local in the When cell/);
});

test('L3-B: a BOM before a fence on line 1 is read as the checker reads it (the same gates either way)', () => {
  const table = '<!-- roadmap:gates -->\n| ID | Command | Environment | When | Baseline |\n|---|---|---|---|---|\n| g1 | npm test | local | always | green |\n<!-- /roadmap:gates -->\n';
  for (const md of ['﻿```\n' + table + '```\n', '﻿' + table, '```\n' + table + '```\n']) {
    const theirs = readBlocks(md, 'gates').length ? parseTable(readBlocks(md, 'gates')[0].body).length : 0;
    assert.equal(parseGatesTable(md).length, theirs, JSON.stringify(md.slice(0, 8)));
  }
});

test('A1: a derived config points to CLAUDE.md instead of copying it', () => {
  const home = mkdtempSync(join(tmpdir(), 'home-'));
  const withDoc = repoWithRoadmap(false);
  const big = 'SENTINEL-RULE-TEXT '.repeat(5000);
  writeFileSync(join(withDoc.root, 'CLAUDE.md'), big);
  const r = runPreflight(withDoc.dir, { home });
  assert.equal(r.config.projectContext, 'Project rules: CLAUDE.md at the repository root (already in your context; if not, read it).');
  assert.ok(r.config.projectContext.length < 200);
  assert.ok(JSON.stringify(r.config).length < 4096);
  assert.ok(!JSON.stringify(r).includes('SENTINEL-RULE-TEXT'));
  const without = repoWithRoadmap(false);
  assert.equal(runPreflight(without.dir, { home }).config.projectContext, '');
});
