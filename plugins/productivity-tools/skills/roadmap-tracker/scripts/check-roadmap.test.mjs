import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FORMAT_VERSION,
  CHECKER_VERSION,
  readBlocks,
  parseTable,
  loadRoadmap,
  validateConfig,
  scanFences,
  checkRoadmap,
  parseRoadmap,
  createGitAdapter,
  compareVersions,
  findNewerPluginCopy,
} from './check-roadmap.mjs';
import * as fmt from '../../../lib/roadmap-format.mjs';
import { embedText, embedFile, checkPureSource } from '../../../scripts/embed.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const VALID = path.join(here, 'fixtures', 'valid');
const SCRIPT = path.join(here, 'check-roadmap.mjs');

const okGit = { commitExists: () => true, isAncestor: () => true, branchExists: () => true };

// ---------- helpers ----------

const created = [];

function tmp(prefix = 'roadmap-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  created.push(dir);
  return dir;
}

after(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

// Reads a folder with CRLF normalized to LF, so mutations can use '\n' on any checkout.
function readFolder(dir) {
  const files = {};
  for (const name of fs.readdirSync(dir)) files[name] = fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n');
  return files;
}

function fixture(mutate) {
  const dir = tmp();
  const files = readFolder(VALID);
  if (mutate) mutate(files);
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

function rep(files, name, from, to) {
  assert.ok(files[name].includes(from), `fixture ${name} lacks: ${from}`);
  files[name] = files[name].replace(from, () => to);
}

function repAll(files, name, from, to) {
  assert.ok(files[name].includes(from), `fixture ${name} lacks: ${from}`);
  files[name] = files[name].split(from).join(to);
}

function run(folder, git = okGit) {
  return checkRoadmap(loadRoadmap(folder), git);
}

const codes = (problems) => problems.map((p) => p.code);

function expectCode(problems, code, severity) {
  const hit = problems.find((p) => p.code === code);
  assert.ok(hit, `expected ${code}, got [${codes(problems).join(', ')}]`);
  assert.equal(hit.severity, severity, `${code} severity`);
}

function git(dir, ...args) {
  const r = spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function repoFixture(mutate) {
  const dir = fixture(mutate);
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  git(dir, 'branch', '-M', 'main');
  return dir;
}

function cli(args, options = {}) {
  const cache = tmp('roadmap-cache-');
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ROADMAP_CHECK_PLUGIN_CACHE: cache, ...(options.env || {}) },
    cwd: options.cwd,
  });
  return r;
}

function toCRLF(files) {
  for (const k of Object.keys(files)) files[k] = files[k].replace(/\r?\n/g, '\r\n');
}

function localizePtBR(files) {
  const map = [
    ['not-started', 'não iniciada'],
    ['integrated', 'integrada'],
    ['in-force', 'vigente'],
    ['superseded by', 'substituída por'],
    ['covered', 'coberto'],
    ['out-of-scope', 'fora de escopo'],
    ['needs-clarification', 'precisa de esclarecimento'],
  ];
  for (const [from, to] of map) repAll(files, 'roadmap.config.json', `"${from}"`, `"${to}"`);
  repAll(files, 'state.md', 'not-started', 'não iniciada');
  repAll(files, 'decisions.md', 'in-force', 'vigente');
  repAll(files, 'requirements.md', '| covered |', '| coberto |');
  repAll(files, 'requirements.md', 'out-of-scope:', 'fora de escopo:');
}

function clearDecisions(files) {
  for (const k of Object.keys(files)) {
    if (!k.endsWith('.md')) continue;
    files[k] = files[k]
      .split('\n')
      .filter((l) => !l.includes('DEC-001'))
      .join('\n');
  }
}

function keepOneLogRow(files) {
  const lines = files['log.md'].split('\n');
  let seen = 0;
  files['log.md'] = lines
    .filter((l) => {
      if (/^\|\s*\d{4}-\d{2}-\d{2}/.test(l)) return ++seen === 1;
      return true;
    })
    .join('\n');
}

// ---------- exports and header ----------

test('script header and constants', () => {
  const first = fs.readFileSync(SCRIPT, 'utf8').split(/\r?\n/)[0];
  assert.equal(first, '// check-roadmap 1.5.0 format 1');
  assert.equal(FORMAT_VERSION, 1);
  assert.equal(CHECKER_VERSION, '1.5.0');
});

test('script imports only node: modules', () => {
  const text = fs.readFileSync(SCRIPT, 'utf8');
  const specs = [...text.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  assert.ok(specs.length > 0);
  for (const s of specs) assert.ok(s.startsWith('node:'), s);
});

// ---------- parsing ----------

test('readBlocks reads attrs and nested bodies', () => {
  const text = '<!-- roadmap:card id=E1 size="two weeks" -->\nbody\n<!-- roadmap:acceptance -->\n1. a\n<!-- /roadmap:acceptance -->\n<!-- /roadmap:card -->';
  const cards = readBlocks(text, 'card');
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].attrs, { id: 'E1', size: 'two weeks' });
  assert.equal(readBlocks(cards[0].body, 'acceptance').length, 1);
});

test('readBlocks does not confuse names sharing a prefix', () => {
  const text = '<!-- roadmap:now2 -->\nx\n<!-- /roadmap:now2 -->';
  assert.deepEqual(readBlocks(text, 'now'), []);
});

test('escaped pipe stays in one cell', () =>
  assert.deepEqual(parseTable('|a|b|\n|-|-|\n|x \\| y|z|'), [['x | y', 'z']]));

test('parseTable drops header and separator, trims cells', () =>
  assert.deepEqual(parseTable('| A | B |\n|:--|--:|\n| 1 | 2 |\n| 3 | 4 |'), [['1', '2'], ['3', '4']]));

test('loadRoadmap throws config: on missing config', () => {
  assert.throws(() => loadRoadmap(tmp()), /^Error: config:/);
});

test('loadRoadmap throws config: on invalid config', () => {
  const dir = fixture((f) => rep(f, 'roadmap.config.json', '"tracks"', '"trackz"'));
  assert.throws(() => loadRoadmap(dir), /^Error: config:/);
});

// ---------- structural checks ----------

test('valid fixture has no problems', () => assert.deepEqual(run(fixture()), []));

test('format-version newer than checker is an error', () =>
  expectCode(run(fixture((f) => rep(f, 'roadmap.config.json', '"formatVersion": 1', '"formatVersion": 2'))), 'format-version', 'error'));

test('unknown-id', () =>
  expectCode(run(fixture((f) => rep(f, 'state.md', '- (owner) Confirm', '- (owner) See DEC-099. Confirm'))), 'unknown-id', 'error'));

test('unknown-id for an unknown deliverable in a dependency', () =>
  expectCode(run(fixture((f) => rep(f, 'strategy.md', 'depends=E1 reqs=REQ-001,REQ-002', 'depends=E7 reqs=REQ-001,REQ-002'))), 'unknown-id', 'error'));

test('duplicate-id', () =>
  expectCode(run(fixture((f) => rep(f, 'sources.md', '| SRC-02 | `docs/notes.md`', '| SRC-01 | `docs/notes.md`'))), 'duplicate-id', 'error'));

test('bad-status', () =>
  expectCode(run(fixture((f) => rep(f, 'state.md', '| E3 | not-started |', '| E3 | bogus |'))), 'bad-status', 'error'));

test('multi-segment status with labels and notes is accepted', () =>
  assert.deepEqual(
    run(fixture((f) => rep(f, 'state.md', '| E2 | not-started |', '| E2 | piece 1: spec (draft); piece 2: not-started |'))),
    [],
  ));

test('now-limit', () =>
  expectCode(
    run(fixture((f) => rep(f, 'state.md', '3. Prepare the integration branch.', '3. Prepare the integration branch.\n4. d\n5. e\n6. f'))),
    'now-limit',
    'error',
  ));

test('cell-limit', () =>
  expectCode(run(fixture((f) => rep(f, 'log.md', 'Roadmap created', 'x'.repeat(301)))), 'cell-limit', 'error'));

test('log-order', () =>
  expectCode(run(fixture((f) => rep(f, 'log.md', '| 2026-01-02 | E2', '| 2025-12-01 | E2'))), 'log-order', 'error'));

test('banned-phrase', () =>
  expectCode(run(fixture((f) => rep(f, 'log.md', 'Roadmap created', 'Roadmap created in This Commit'))), 'banned-phrase', 'error'));

test('missing-evidence', () =>
  expectCode(run(fixture((f) => rep(f, 'log.md', '| Roadmap created | `strategy.md` |', '| Roadmap created |  |'))), 'missing-evidence', 'error'));

test('uncovered-req: covered without deliverables', () =>
  expectCode(run(fixture((f) => rep(f, 'requirements.md', '| E1, E2 | covered |', '| - | covered |'))), 'uncovered-req', 'error'));

test('uncovered-req: out-of-scope without reason', () =>
  expectCode(run(fixture((f) => rep(f, 'requirements.md', 'out-of-scope: not in the first release', 'out-of-scope'))), 'uncovered-req', 'error'));

test('uncovered-req: unknown coverage value', () =>
  expectCode(run(fixture((f) => rep(f, 'requirements.md', '| E2, E3 | covered |', '| E2, E3 | maybe |'))), 'uncovered-req', 'error'));

test('card-no-req', () =>
  expectCode(run(fixture((f) => rep(f, 'strategy.md', 'depends=- reqs=REQ-001 critical=true', 'depends=- reqs=- critical=true'))), 'card-no-req', 'error'));

test('card-acceptance', () =>
  expectCode(
    run(fixture((f) => { f['strategy.md'] = f['strategy.md'].replace(/2\. Given no items.*\n/, ''); })),
    'card-acceptance',
    'error',
  ));

test('card-no-panel-row', () =>
  expectCode(run(fixture((f) => rep(f, 'state.md', '| E3 | not-started | - | Wait for E2 |\n', ''))), 'card-no-panel-row', 'error'));

test('panel-unknown-deliverable', () =>
  expectCode(
    run(fixture((f) => rep(f, 'state.md', '| E3 | not-started | - | Wait for E2 |', '| E3 | not-started | - | Wait for E2 |\n| E9 | spec | - | x |'))),
    'panel-unknown-deliverable',
    'error',
  ));

test('dependency-cycle', () => {
  const problems = run(fixture((f) => rep(f, 'strategy.md', 'depends=- reqs=REQ-001 critical=true', 'depends=E3 reqs=REQ-001 critical=true')));
  expectCode(problems, 'dependency-cycle', 'error');
  assert.equal(codes(problems).filter((c) => c === 'dependency-cycle').length, 1);
  assert.match(problems.find((p) => p.code === 'dependency-cycle').message, /E1/);
});

test('superseded-link to a missing target', () =>
  expectCode(run(fixture((f) => rep(f, 'decisions.md', '| SRC-01 | in-force |', '| SRC-01 | superseded by DEC-009 |'))), 'superseded-link', 'error'));

test('superseded-link to an existing target passes', () => {
  const problems = run(
    fixture((f) => {
      rep(f, 'decisions.md', '| SRC-01 | in-force |', '| SRC-01 | superseded by DEC-002 |\n| DEC-002 | 2026-01-03 | E2 | Sharing ships in piece 3 | Piece 2 | - | - | SRC-01 | in-force |');
      rep(f, 'log.md', '| 2026-01-02 | E2', '| 2026-01-03 | E2 | DEC-002 recorded | `decisions.md` |\n| 2026-01-02 | E2');
    }),
  );
  assert.deepEqual(codes(problems), []);
});

test('unknown-track', () =>
  expectCode(run(fixture((f) => rep(f, 'strategy.md', 'id=E1 phase=skeleton track=engineering', 'id=E1 phase=skeleton track=bogus'))), 'unknown-track', 'error'));

test('bad-priority', () =>
  expectCode(run(fixture((f) => rep(f, 'strategy.md', 'priority=Must size="not estimated" depends=- ', 'priority=Urgent size="not estimated" depends=- '))), 'bad-priority', 'error'));

test('missing-block', () =>
  expectCode(run(fixture((f) => rep(f, 'state.md', '<!-- roadmap:pending -->', '<!-- roadmap:pendingx -->'))), 'missing-block', 'error'));

// ---------- warnings ----------

test('contradiction-unabsorbed', () =>
  expectCode(run(fixture((f) => repAll(f, 'strategy.md', 'DEC-001', 'the decision'))), 'contradiction-unabsorbed', 'warning'));

test('needs-clarification', () =>
  expectCode(run(fixture((f) => rep(f, 'requirements.md', 'out-of-scope: not in the first release', 'needs-clarification'))), 'needs-clarification', 'warning'));

test('critical-no-risk', () =>
  expectCode(run(fixture((f) => rep(f, 'strategy.md', '- The storage layer is unproven -> build it first and test it alone.\n', ''))), 'critical-no-risk', 'warning'));

test('markers warning counts markers', () => {
  const problems = run(fixture((f) => rep(f, 'strategy.md', 'None recorded.', 'ASSUMPTION: the owner agrees. UNSOURCED: a number.')));
  expectCode(problems, 'markers', 'warning');
  assert.match(problems.find((p) => p.code === 'markers').message, /2/);
});

test('req-card-asymmetry', () =>
  expectCode(run(fixture((f) => rep(f, 'requirements.md', '| E2, E3 | covered |', '| E2 | covered |'))), 'req-card-asymmetry', 'warning'));

// ---------- Review Focus ----------

test('CRLF files parse like LF', () => assert.deepEqual(run(fixture(toCRLF)), []));

test('localized accented vocabulary', () => assert.deepEqual(run(fixture(localizePtBR)), []));

test('fresh roadmap passes', () =>
  assert.deepEqual(
    run(
      fixture((f) => {
        clearDecisions(f);
        keepOneLogRow(f);
      }),
    ),
    [],
  ));

// ---------- git checks ----------

test('git: sha-missing in panel evidence', () => {
  const dir = repoFixture((f) => rep(f, 'state.md', '`docs/spec-e1.md`', '`deadbeef1234`'));
  expectCode(run(dir, createGitAdapter(dir)), 'sha-missing', 'error');
});

test('git: sha-missing in log evidence is only a warning', () => {
  const dir = repoFixture((f) => rep(f, 'log.md', '| `strategy.md` |', '| `deadbeef1234` |'));
  expectCode(run(dir, createGitAdapter(dir)), 'sha-missing', 'warning');
});

test('git: valid fixture in a repo has no problems', () => {
  const dir = repoFixture();
  assert.deepEqual(run(dir, createGitAdapter(dir)), []);
});

test('git: not-integrated until the sha is merged into main', () => {
  const dir = repoFixture();
  git(dir, 'checkout', '-q', '-b', 'feat');
  fs.writeFileSync(path.join(dir, 'feature.txt'), 'x');
  git(dir, 'add', 'feature.txt');
  git(dir, 'commit', '-q', '-m', 'feature');
  const sha = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'checkout', '-q', 'main');
  const state = fs.readFileSync(path.join(dir, 'state.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'state.md'), state.replace('| E1 | spec | `docs/spec-e1.md` |', `| E1 | integrated | \`${sha}\` |`));
  expectCode(run(dir, createGitAdapter(dir)), 'not-integrated', 'error');
  git(dir, 'merge', '-q', 'feat');
  assert.deepEqual(run(dir, createGitAdapter(dir)), []);
});

test('git: inflight branch checks', () => {
  const dir = repoFixture();
  git(dir, 'branch', 'feat');
  const row = (b, k) => `| \`${b}\` | ${k} | note |`;
  const original = fs.readFileSync(path.join(dir, 'state.md'), 'utf8');
  const set = (rows) => {
    const state = original;
    fs.writeFileSync(path.join(dir, 'state.md'), state.replace('| Branch | Kind | Note |\n|---|---|---|\n', `| Branch | Kind | Note |\n|---|---|---|\n${rows}\n`));
  };
  set(row('feat', 'live'));
  assert.deepEqual(run(dir, createGitAdapter(dir)), []);
  set(row('feat/nope', 'live'));
  expectCode(run(dir, createGitAdapter(dir)), 'branch-live-missing', 'error');
  set(row('feat', 'deleted'));
  expectCode(run(dir, createGitAdapter(dir)), 'branch-deleted-exists', 'error');
  set(row('gone', 'deleted'));
  assert.deepEqual(run(dir, createGitAdapter(dir)).filter((p) => p.code === 'branch-deleted-exists'), []);
});

test('git: no repo yields one no-git warning and nothing else', () => {
  const problems = run(fixture((f) => rep(f, 'state.md', '`docs/spec-e1.md`', '`deadbeef1234`')), null);
  assert.deepEqual(codes(problems), ['no-git']);
  assert.equal(problems[0].severity, 'warning');
});

test('git: createGitAdapter returns null outside a repo', () => {
  assert.equal(createGitAdapter(tmp()), null);
});

test('git: falls back to origin/<branch> when the local branch is missing', () => {
  const dir = repoFixture();
  const sha = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'branch', '-m', 'main', 'other');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  const state = fs.readFileSync(path.join(dir, 'state.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'state.md'), state.replace('| E1 | spec | `docs/spec-e1.md` |', `| E1 | integrated | \`${sha}\` |`));
  assert.deepEqual(run(dir, createGitAdapter(dir)), []);
});

test('git: neither local nor origin branch gives one warning, no false error', () => {
  const dir = repoFixture();
  const sha = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'branch', '-m', 'main', 'other');
  const state = fs.readFileSync(path.join(dir, 'state.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'state.md'), state.replace('| E1 | spec | `docs/spec-e1.md` |', `| E1 | integrated | \`${sha}\` |`));
  const problems = run(dir, createGitAdapter(dir));
  assert.deepEqual(codes(problems), ['integration-branch-missing']);
  assert.equal(problems[0].severity, 'warning');
});

// ---------- CLI ----------

test('cli --version', () => {
  const r = cli(['--version']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '1.5.0 format 1');
});

test('cli exit 0 on the valid fixture, with summary', () => {
  const r = cli([VALID]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /check-roadmap: 0 error\(s\), \d+ warning\(s\)/);
});

test('cli exit 1 on an error, prints ERROR line with code', () => {
  const dir = fixture((f) => rep(f, 'state.md', '| E3 | not-started |', '| E3 | bogus |'));
  const r = cli([dir]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^ERROR .*\[bad-status\]$/m);
  assert.match(r.stdout, /check-roadmap: [1-9]\d* error\(s\)/);
});

test('cli config failure prints ERROR and exits 1', () => {
  const r = cli([tmp()]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^ERROR config:/m);
});

test('cli with no argument checks its own folder, path with a space', () => {
  const dir = path.join(tmp(), 'with space');
  fs.mkdirSync(dir);
  for (const [name, text] of Object.entries(readFolder(VALID))) fs.writeFileSync(path.join(dir, name), text);
  fs.copyFileSync(SCRIPT, path.join(dir, 'check-roadmap.mjs'));
  const r = spawnSync(process.execPath, [path.join(dir, 'check-roadmap.mjs')], {
    encoding: 'utf8',
    cwd: os.tmpdir(),
    env: { ...process.env, ROADMAP_CHECK_PLUGIN_CACHE: tmp('roadmap-cache-') },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /0 error\(s\)/);
});

function cacheWith(version) {
  const cache = tmp('roadmap-cache-');
  const dir = path.join(cache, 'mkt', 'productivity-tools', version, 'skills', 'roadmap-tracker', 'scripts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'check-roadmap.mjs'), `// check-roadmap ${version} format 1\nexport {};\n`);
  return cache;
}

test('cli warns checker-stale when a newer plugin copy exists, still exit 0', () => {
  const r = cli([VALID], { env: { ROADMAP_CHECK_PLUGIN_CACHE: cacheWith('1.9.0') } });
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.stdout.split('checker-stale').length - 1, 1);
  assert.match(r.stdout, /1\.9\.0/);
});

test('cli: no stale warning for an older copy or an empty cache', () => {
  assert.doesNotMatch(cli([VALID], { env: { ROADMAP_CHECK_PLUGIN_CACHE: cacheWith('1.1.0') } }).stdout, /checker-stale/);
  assert.doesNotMatch(cli([VALID]).stdout, /checker-stale/);
});

test('findNewerPluginCopy ignores the script itself', () => {
  const cache = cacheWith('1.3.0');
  const self = path.join(cache, 'mkt', 'productivity-tools', '1.3.0', 'skills', 'roadmap-tracker', 'scripts', 'check-roadmap.mjs');
  assert.equal(findNewerPluginCopy(self, '1.2.0', cache), null);
  const other = findNewerPluginCopy('/elsewhere/check-roadmap.mjs', '1.2.0', cache);
  assert.equal(other.version, '1.3.0');
  assert.equal(findNewerPluginCopy('/elsewhere/check-roadmap.mjs', '1.2.0', path.join(cache, 'missing')), null);
});

test('compareVersions', () => {
  assert.equal(compareVersions('1.10.0', '1.9.0'), 1);
  assert.equal(compareVersions('1.2.0', '1.2.0'), 0);
  assert.equal(compareVersions('1.2.0', '1.10.0'), -1);
});

// ---------- fix-up round 1 ----------

function copyRoadmapTo(dir, { crlf = false } = {}) {
  const conv = (s) => (crlf ? s.replace(/\r?\n/g, '\r\n') : s);
  for (const [name, text] of Object.entries(readFolder(VALID))) fs.writeFileSync(path.join(dir, name), conv(text));
  fs.writeFileSync(path.join(dir, 'check-roadmap.mjs'), conv(fs.readFileSync(SCRIPT, 'utf8')));
}

function spawnScript(script, cwd) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ROADMAP_CHECK_PLUGIN_CACHE: tmp('roadmap-cache-') },
  });
}

test('fix1: cli runs through a symlink or junction path (run guard uses realpath)', (t) => {
  const real = tmp();
  copyRoadmapTo(real);
  const link = path.join(tmp(), 'link');
  try {
    fs.symlinkSync(real, link, 'junction');
  } catch (e) {
    if (e.code === 'EPERM') return t.skip('cannot create symlink here');
    throw e;
  }
  const r = spawnScript(path.join(link, 'check-roadmap.mjs'), os.tmpdir());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /check-roadmap: 0 error\(s\)/);
});

test('fix2: CRLF fixture and CRLF script run through the CLI; CRLF header is read', () => {
  const dir = tmp();
  copyRoadmapTo(dir, { crlf: true });
  assert.match(fs.readFileSync(path.join(dir, 'check-roadmap.mjs'), 'utf8'), /\r\n/);
  const r = spawnScript(path.join(dir, 'check-roadmap.mjs'), os.tmpdir());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /check-roadmap: 0 error\(s\)/);
  assert.equal(spawnSync(process.execPath, [path.join(dir, 'check-roadmap.mjs'), '--version'], { encoding: 'utf8' }).stdout.trim(), '1.5.0 format 1');
  const cache = tmp('roadmap-cache-');
  const scripts = path.join(cache, 'mkt', 'productivity-tools', '1.3.0', 'skills', 'roadmap-tracker', 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  fs.writeFileSync(path.join(scripts, 'check-roadmap.mjs'), '// check-roadmap 1.3.0 format 1\r\nexport {};\r\n');
  assert.equal(findNewerPluginCopy('/elsewhere/x.mjs', '1.2.0', cache).version, '1.3.0');
});

test('fix3: bad-row when a row has too few columns', () =>
  expectCode(run(fixture((f) => rep(f, 'state.md', '| E3 | not-started | - | Wait for E2 |', '| E3 | not-started | - |'))), 'bad-row', 'error'));

test('fix3: bad-row when an unescaped pipe adds a column', () =>
  expectCode(run(fixture((f) => rep(f, 'log.md', '| Roadmap created | `strategy.md` |', '| Roadmap created | x a|b | `strategy.md` |'))), 'bad-row', 'error'));

test('fix3: unclosed-block', () =>
  expectCode(run(fixture((f) => rep(f, 'state.md', '<!-- /roadmap:pending -->\n', ''))), 'unclosed-block', 'error'));

test('fix4: integrated-no-sha, independent of git', () => {
  const dir = fixture((f) => rep(f, 'state.md', '| E1 | spec |', '| E1 | integrated |'));
  expectCode(run(dir, okGit), 'integrated-no-sha', 'error');
  expectCode(run(dir, null), 'integrated-no-sha', 'error');
});

test('fix5: shallow clone warns once and skips sha and ancestry checks', () => {
  const src = repoFixture();
  fs.writeFileSync(path.join(src, 'more.txt'), 'x');
  git(src, 'add', 'more.txt');
  git(src, 'commit', '-q', '-m', 'second');
  const dst = path.join(tmp(), 'clone');
  const c = spawnSync('git', ['clone', '-q', '--depth', '1', pathToFileURL(src).href, dst], { encoding: 'utf8' });
  assert.equal(c.status, 0, c.stderr);
  const state = fs.readFileSync(path.join(dst, 'state.md'), 'utf8');
  fs.writeFileSync(path.join(dst, 'state.md'), state.replace('| E1 | spec | `docs/spec-e1.md` |', '| E1 | integrated | `deadbeef1234` |'));
  const problems = run(dst, createGitAdapter(dst));
  assert.deepEqual(codes(problems), ['shallow-clone']);
  assert.equal(problems[0].severity, 'warning');
});

test('fix5: sha-missing is reported once per sha per file', () => {
  const dir = repoFixture((f) => {
    rep(f, 'log.md', '| `decisions.md` |', '| `deadbeef1234` |');
    rep(f, 'log.md', '| `strategy.md` |', '| `deadbeef1234` |');
  });
  const problems = run(dir, createGitAdapter(dir));
  assert.equal(codes(problems).filter((c) => c === 'sha-missing').length, 1);
});

test('fix6: log may cite retired BLQ and E ids, but not unknown REQ/DEC/SRC', () => {
  const retired = fixture((f) => rep(f, 'log.md', '| 2026-01-02 | E2', '| 2026-01-03 | E9 | BLQ-7 closed, E9 dropped | `decisions.md` |\n| 2026-01-02 | E2'));
  assert.deepEqual(run(retired), []);
  const unknown = fixture((f) => rep(f, 'log.md', '| 2026-01-02 | E2', '| 2026-01-03 | - | REQ-999 added | `decisions.md` |\n| 2026-01-02 | E2'));
  expectCode(run(unknown), 'unknown-id', 'error');
});

test('strategy may cite a retired BLQ, but not an undefined REQ or E', () => {
  const retired = fixture((f) => rep(f, 'strategy.md', 'No deliverable started. See `state.md`.', 'No deliverable started. See `state.md`. BLQ-7 was closed.'));
  assert.deepEqual(run(retired), []);
  const req = fixture((f) => rep(f, 'strategy.md', 'No deliverable started. See `state.md`.', 'No deliverable started. See `state.md`. REQ-999 is open.'));
  expectCode(run(req), 'unknown-id', 'error');
  const del = fixture((f) => rep(f, 'strategy.md', 'No deliverable started. See `state.md`.', 'No deliverable started. See `state.md`. E9 was dropped.'));
  expectCode(run(del), 'unknown-id', 'error');
});

test('scanFences reports an unclosed fence and blanks fenced lines', () => {
  const closed = scanFences('a\n```\nREQ-1\n```\nb', false);
  assert.equal(closed.unclosed, false);
  assert.ok(!closed.text.includes('REQ-1'));
  const open = scanFences('a\n```\nREQ-1\nb', false);
  assert.equal(open.unclosed, true);
  assert.ok(!open.text.includes('REQ-1'));
});

test('fix6: ids in non-mermaid fenced blocks are ignored, in mermaid blocks checked', () => {
  const ignored = fixture((f) => (f['critical-path.md'] += '\n```text\nREQ-999\n```\n'));
  assert.deepEqual(run(ignored), []);
  const checked = fixture((f) => rep(f, 'critical-path.md', '  E2 --> E3\n', '  E2 --> E3\n  E9 --> E1\n'));
  expectCode(run(checked), 'unknown-id', 'error');
});

test('fix8: NFC config with NFD files (and the reverse) matches', () => {
  const nfdFiles = fixture((f) => {
    localizePtBR(f);
    for (const k of ['state.md', 'decisions.md', 'requirements.md']) f[k] = f[k].normalize('NFD');
  });
  assert.deepEqual(run(nfdFiles), []);
  const nfdConfig = fixture((f) => {
    localizePtBR(f);
    f['roadmap.config.json'] = f['roadmap.config.json'].normalize('NFD');
  });
  assert.deepEqual(run(nfdConfig), []);
});

test('fix9: no-git and integration-branch-missing name the config file', () => {
  const p = run(fixture(), null);
  assert.equal(p[0].file, 'roadmap.config.json');
  const dir = repoFixture();
  const sha = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'branch', '-m', 'main', 'other');
  const state = fs.readFileSync(path.join(dir, 'state.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'state.md'), state.replace('| E1 | spec | `docs/spec-e1.md` |', `| E1 | integrated | \`${sha}\` |`));
  assert.equal(run(dir, createGitAdapter(dir))[0].file, 'roadmap.config.json');
});

test('fix9: balanced nested parentheses in a status note are accepted', () =>
  assert.deepEqual(run(fixture((f) => rep(f, 'state.md', '| E2 | not-started |', '| E2 | piece 1: spec (see (a) and (b)); piece 2: not-started |'))), []));

// ---------- fix-up round 2 ----------

test('round2: an all-digit 7-char SHA counts as evidence', () => {
  const dir = fixture((f) => rep(f, 'state.md', '| E1 | spec | `docs/spec-e1.md` |', '| E1 | integrated | `4821937` |'));
  assert.ok(!codes(run(dir, okGit)).includes('integrated-no-sha'));
  const missing = { ...okGit, commitExists: () => false };
  expectCode(run(dir, missing), 'sha-missing', 'error');
});

// ---------- line 1 is the runtime version source ----------

function scriptCopy(line1) {
  const dir = tmp();
  const lines = fs.readFileSync(SCRIPT, 'utf8').split(/\r?\n/);
  lines[0] = line1;
  const file = path.join(dir, 'check-roadmap.mjs');
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}


test('header: --version reads the running file line 1', () => {
  const r = spawnSync(process.execPath, [scriptCopy('// check-roadmap 1.1.0 format 1'), '--version'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '1.1.0 format 1');
});

test('header: stale check uses the running file line 1', () => {
  const file = scriptCopy('// check-roadmap 1.1.0 format 1');
  const r = spawnSync(process.execPath, [file, VALID], {
    encoding: 'utf8',
    env: { ...process.env, ROADMAP_CHECK_PLUGIN_CACHE: cacheWith('1.2.0') },
  });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /\[checker-stale\]/);
});

test('header: malformed line 1 makes --version fail with an ERROR line', () => {
  const r = spawnSync(process.execPath, [scriptCopy('// check-roadmap banana'), '--version'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^ERROR /m);
});

// ---------- final review fixes ----------

test('header: exported constants derive from line 1 of the running file', async () => {
  const m = /^\/\/ check-roadmap (\S+) format (\d+)$/.exec(fs.readFileSync(SCRIPT, 'utf8').split(/\r?\n/)[0]);
  assert.equal(m[1], CHECKER_VERSION);
  assert.equal(Number(m[2]), FORMAT_VERSION);
  const copy = scriptCopy('// check-roadmap 1.9.0 format 3');
  const mod = await import(pathToFileURL(copy).href);
  assert.equal(mod.CHECKER_VERSION, '1.9.0');
  assert.equal(mod.FORMAT_VERSION, 3);
});

function withFeatCommit(dir) {
  const a = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'checkout', '-q', '-b', 'feat');
  fs.writeFileSync(path.join(dir, 'feature.txt'), 'x');
  git(dir, 'add', 'feature.txt');
  git(dir, 'commit', '-q', '-m', 'feature');
  const b = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'checkout', '-q', 'main');
  return { a, b };
}

function setE1(dir, status, evidence) {
  const state = fs.readFileSync(path.join(dir, 'state.md'), 'utf8');
  const lines = state.split('\n').map((l) => (l.startsWith('| E1 |') ? `| E1 | ${status} | ${evidence} | Next |` : l));
  fs.writeFileSync(path.join(dir, 'state.md'), lines.join('\n'));
}

test('final1: per-piece status needs only one integrated SHA; siblings only need to exist', () => {
  const dir = repoFixture();
  const { a, b } = withFeatCommit(dir);
  setE1(dir, 'piece 1: integrated; piece 2: on-branch', `\`${a}\` \`${b}\``);
  assert.deepEqual(run(dir, createGitAdapter(dir)), []);
  setE1(dir, 'piece 1: integrated; piece 2: on-branch', `\`${b}\` \`deadbeef1234\``);
  const codesNow = codes(run(dir, createGitAdapter(dir)));
  assert.ok(codesNow.includes('not-integrated') || codesNow.includes('sha-missing'));
  setE1(dir, 'integrated', `\`${b}\``);
  expectCode(run(dir, createGitAdapter(dir)), 'not-integrated', 'error');
});

test('final2: sha-missing in the panel stays an error, in the log is a warning', () => {
  const dir = repoFixture((f) => {
    rep(f, 'state.md', '`docs/spec-e1.md`', '`deadbeef1234`');
    rep(f, 'log.md', '| `strategy.md` |', '| `cafebabe5678` |');
  });
  const problems = run(dir, createGitAdapter(dir));
  const sev = (file) => problems.find((p) => p.code === 'sha-missing' && p.file === file).severity;
  assert.equal(sev('state.md'), 'error');
  assert.equal(sev('log.md'), 'warning');
});

test('final3: a stale local branch is fine when origin/<branch> contains the SHA', () => {
  const dir = repoFixture();
  const { b } = withFeatCommit(dir);
  git(dir, 'update-ref', 'refs/remotes/origin/main', b);
  setE1(dir, 'integrated', `\`${b}\``);
  assert.deepEqual(run(dir, createGitAdapter(dir)), []);
  git(dir, 'update-ref', '-d', 'refs/remotes/origin/main');
  expectCode(run(dir, createGitAdapter(dir)), 'not-integrated', 'error');
});

test('final5: the fixture has a Phases section', () => {
  assert.match(fs.readFileSync(path.join(VALID, 'strategy.md'), 'utf8'), /^## Phases$/m);
});

test('final5: a roadmap assembled verbatim from the formats.md templates has 0 errors', (t) => {
  const formats = path.join(here, '..', '..', 'roadmap-planner', 'references', 'formats.md');
  if (!fs.existsSync(formats)) return t.skip('formats.md not found');
  const text = fs.readFileSync(formats, 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...text.matchAll(/^(`{3,})(\w*)\n([\s\S]*?)^\1[ \t]*$/gm)].map((m) => m[3]);
  const pick = (needle) => {
    const b = blocks.find((x) => x.includes(needle));
    assert.ok(b, `no template containing ${needle}`);
    return b;
  };
  const card = pick('<!-- roadmap:card');
  const files = {
    'roadmap.config.json': pick('"formatVersion"').replace(/"strategy":\s*"[^"]*"/, '"strategy": "strategy.md"'),
    'strategy.md': pick('<!-- roadmap:version').replace('<one card per deliverable, see below>', card),
    'state.md': pick('<!-- roadmap:now'),
    'decisions.md': pick('<!-- roadmap:decisions'),
    'log.md': pick('<!-- roadmap:log'),
    'sources.md': pick('<!-- roadmap:sources'),
    'requirements.md': pick('<!-- roadmap:requirements'),
    'critical-path.md': pick('graph LR'),
    'README.md': pick('# <Topic> roadmap'),
  };
  const dir = tmp();
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body.split('<ISO date>').join('2026-01-01'));
  const problems = run(dir, null);
  assert.deepEqual(problems.filter((p) => p.severity === 'error'), []);
});

// ---------- round 2 (1.3.0): checker defects and format additions ----------

function setConfig(mutate) {
  return fixture((f) => {
    const c = JSON.parse(f['roadmap.config.json']);
    mutate(c);
    f['roadmap.config.json'] = JSON.stringify(c, null, 2);
  });
}

function bulkCommits(dir, n) {
  let stream = '';
  for (let i = 0; i < n; i++) {
    stream += `commit refs/heads/bulk\ncommitter t <t@t> ${1700000000 + i} +0000\ndata 5\nc${String(i).padStart(3, '0')}\n`;
    stream += 'M 100644 inline f.txt\ndata 4\n' + String(i).padStart(3, '0') + '\n\n';
  }
  const r = spawnSync('git', ['-C', dir, 'fast-import', '--quiet'], { input: stream, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return git(dir, 'rev-list', 'bulk').split('\n');
}

test('r2-1 perf: 300 SHAs in the log are checked with a handful of git processes', () => {
  const dir = repoFixture();
  const shas = bulkCommits(dir, 300);
  assert.equal(shas.length, 300);
  const rows = shas.map((s) => `| 2026-01-02 | - | Row | ${String.fromCharCode(96)}${s}${String.fromCharCode(96)} |`).join(String.fromCharCode(10));
  const log = fs.readFileSync(path.join(dir, 'log.md'), 'utf8').replace('| 2026-01-02 | E2', () => rows + String.fromCharCode(10) + '| 2026-01-02 | E2');
  fs.writeFileSync(path.join(dir, 'log.md'), log);
  const adapter = createGitAdapter(dir);
  const t0 = Date.now();
  const problems = run(dir, adapter);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 3000, `took ${elapsed} ms`);
  assert.ok(!codes(problems).includes('sha-missing'), codes(problems).join(','));
});

test('r2-1 ancestry batching answers the same as one process per sha', () => {
  const dir = repoFixture();
  const shas = bulkCommits(dir, 12);
  const adapter = createGitAdapter(dir);
  git(dir, 'merge', '-q', '--allow-unrelated-histories', '-m', 'm', shas[3]);
  const head = git(dir, 'rev-parse', 'HEAD');
  adapter.prefetch([head, ...shas]);
  const expected = shas.map((s) => spawnSync('git', ['-C', dir, 'merge-base', '--is-ancestor', s, 'main']).status === 0);
  const got = shas.map((s) => adapter.isAncestor(s, 'main'));
  assert.deepEqual(got, expected);
  assert.ok(got.some(Boolean) && !got.every(Boolean));
});

test('r2-2 config: array elements must be non-empty strings', () => {
  for (const [key, bad] of [['markers', ['']], ['bannedPhrases', [3]], ['integratedStatuses', [null]], ['deliverableStatuses', ['ok', '']]]) {
    const dir = setConfig((c) => (c.vocab[key] = bad));
    assert.throws(() => loadRoadmap(dir), new RegExp(`^Error: config: vocab\.${key}`), key);
  }
  assert.throws(() => loadRoadmap(setConfig((c) => (c.tracks = ['a', 5]))), /^Error: config: tracks/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.tracks = ['']))), /^Error: config: tracks/);
});

test('r2-2 config: deliverableStatuses must not be empty', () =>
  assert.throws(() => loadRoadmap(setConfig((c) => (c.vocab.deliverableStatuses = []))), /^Error: config: vocab\.deliverableStatuses/));

test('r2-2 config: limits must be positive numbers (no strings)', () => {
  assert.throws(() => loadRoadmap(setConfig((c) => (c.limits.nowItems = '5'))), /^Error: config: limits\.nowItems/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.limits.cellChars = 0))), /^Error: config: limits\.cellChars/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.limits.other = -1))), /^Error: config: limits\.other/);
});

test('r2-2 config: formatVersion must be an integer >= 1', () => {
  for (const bad of [0, 1.5, '1', -1]) assert.throws(() => loadRoadmap(setConfig((c) => (c.formatVersion = bad))), /^Error: config: formatVersion/, String(bad));
});

test('r2-2 config: file paths cannot escape the folder, be absolute, or collide', () => {
  assert.throws(() => loadRoadmap(setConfig((c) => (c.files.state = '../state.md'))), /^Error: config: files\.state/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.files.state = path.resolve(os.tmpdir(), 'x.md')))), /^Error: config: files\.state/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.strategy = path.resolve(os.tmpdir(), 'x.md')))), /^Error: config: strategy/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.strategy = '../../../../../../x.md'))), /^Error: config: strategy/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.files.log = 'state.md'))), /^Error: config: .*same file/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.strategy = 'state.md'))), /^Error: config: .*same file/);
});

test('r2-2 config: strategy may sit beside the folder (../<file>)', () => {
  const dir = setConfig((c) => (c.strategy = '../roadmap-check-nonexistent-strategy.md'));
  assert.throws(() => loadRoadmap(dir), /cannot read strategy/);
});

test('r2-2 cli: config errors print ERROR config and exit 1', () => {
  const r = cli([setConfig((c) => (c.limits.nowItems = '5'))]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^ERROR config: limits\.nowItems/m);
});

test('r2-2 cli: an unexpected exception prints ERROR internal and exits 2, no stack', () => {
  const r = cli([VALID], { env: { ROADMAP_CHECK_SELFTEST_THROW: '1' } });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /^ERROR internal: /m);
  assert.doesNotMatch(r.stdout + r.stderr, /\n\s+at /);
});

test('r2-3 malformed-anchor: an opener missing --> before the next comment', () => {
  const p = run(fixture((f) => rep(f, 'state.md', '<!-- roadmap:panel -->', '<!-- roadmap:panel')));
  expectCode(p, 'malformed-anchor', 'error');
  assert.match(p.find((x) => x.code === 'malformed-anchor').message, /roadmap:panel/);
});

test('r2-3 attribute parsing is linear on huge tokens', () => {
  for (const attr of ['a'.repeat(300000), `k="${'b'.repeat(300000)}`, 'x='.repeat(150000), ' '.repeat(300000) + 'z']) {
    const t0 = Date.now();
    readBlocks(`<!-- roadmap:card ${attr} -->\nbody\n<!-- /roadmap:card -->`, 'card');
    readBlocks(`<!-- roadmap:card ${attr}`, 'card');
    readBlocks('<!-- '.repeat(60000), 'card');
    assert.ok(Date.now() - t0 < 1000, `slow: ${Date.now() - t0} ms`);
  }
});

test('r2-4 fences: anchors inside any fence are ignored, mermaid included', () => {
  const fake = '<!-- roadmap:now -->\n1. a\n2. b\n3. c\n4. d\n5. e\n6. f\n<!-- /roadmap:now -->';
  for (const info of ['markdown', 'mermaid', '']) {
    const dir = fixture((f) => rep(f, 'state.md', '## Now\n', `## Now\n\n\`\`\`${info}\n${fake}\n\`\`\`\n`));
    assert.deepEqual(run(dir), [], `fence "${info}"`);
  }
});

test('r2-4 fences: tilde fences work and mermaid ids still count', () => {
  const dir = fixture((f) => (f['critical-path.md'] += '\n~~~mermaid\nE9 --> E1\n~~~\n'));
  expectCode(run(dir), 'unknown-id', 'error');
  const ok = fixture((f) => (f['critical-path.md'] += '\n~~~text\nE9 --> E1\n~~~\n'));
  assert.deepEqual(run(ok), []);
});

test('r2-4 fences: an unclosed fence is a warning', () => {
  const p = run(fixture((f) => (f['README.md'] += '\n```text\nnever closed\n')));
  expectCode(p, 'unclosed-fence', 'warning');
  assert.deepEqual(p.filter((x) => x.severity === 'error'), []);
});

test('r2-5 contradiction-unabsorbed matches whole ids (DEC-001 vs DEC-0010)', () => {
  const dir = fixture((f) => {
    repAll(f, 'strategy.md', 'DEC-001', 'DEC-0010');
    rep(f, 'decisions.md', '<!-- /roadmap:decisions -->', '| DEC-0010 | 2026-01-03 | E1 | Other | Another | - | never | user | in-force |\n<!-- /roadmap:decisions -->');
  });
  const p = run(dir);
  expectCode(p, 'contradiction-unabsorbed', 'warning');
  assert.match(p.find((x) => x.code === 'contradiction-unabsorbed').message, /DEC-001 contradicts/);
});

test('r2-6 bad-kind: inflight Kind outside branchLive/branchDeleted', () => {
  const dir = fixture((f) => rep(f, 'state.md', '|---|---|---|\n<!-- /roadmap:inflight -->', '|---|---|---|\n| `feat/x` | weird | note |\n<!-- /roadmap:inflight -->'));
  expectCode(run(dir, null), 'bad-kind', 'error');
});

test('r2-7 invalid UTF-8 is a warning, parsing continues', () => {
  const dir = fixture();
  fs.appendFileSync(path.join(dir, 'README.md'), Buffer.from([0x0a, 0x61, 0xff, 0xfe, 0x0a]));
  const p = run(dir);
  expectCode(p, 'invalid-utf8', 'warning');
  assert.equal(p.find((x) => x.code === 'invalid-utf8').file, 'README.md');
  assert.deepEqual(p.filter((x) => x.severity === 'error'), []);
});

test('r2-8 git-unavailable: distinct from no-git, --require-git makes both errors', () => {
  const p = run(fixture(), { unavailable: true, reason: 'ENOENT' });
  assert.deepEqual(codes(p), ['git-unavailable']);
  assert.equal(p[0].severity, 'warning');
  const req = checkRoadmap(loadRoadmap(fixture()), { unavailable: true, reason: 'x' }, { requireGit: true });
  expectCode(req, 'git-unavailable', 'error');
  expectCode(checkRoadmap(loadRoadmap(fixture()), null, { requireGit: true }), 'no-git', 'error');
});

test('r2-8 git missing from PATH: adapter reports unavailable, CLI warns, --require-git fails', () => {
  const saved = process.env.PATH;
  try {
    process.env.PATH = '';
    const a = createGitAdapter(fixture());
    assert.ok(a && a.unavailable, 'expected an unavailable adapter');
  } finally {
    process.env.PATH = saved;
  }
  const noGitEnv = { PATH: '', Path: '' };
  const r = cli([fixture()], { env: noGitEnv });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /\[git-unavailable\]/);
  assert.doesNotMatch(r.stdout, /\[no-git\]/);
  const strict = cli([fixture(), '--require-git'], { env: noGitEnv });
  assert.equal(strict.status, 1);
  assert.match(strict.stdout, /^ERROR .*\[git-unavailable\]$/m);
  const strictNoRepo = cli([fixture(), '--require-git']);
  assert.equal(strictNoRepo.status, 1);
  assert.match(strictNoRepo.stdout, /^ERROR .*\[no-git\]$/m);
});

test('r2-9 statuses blocked and discarded are valid by default; old status lists still pass', () => {
  assert.deepEqual(run(fixture((f) => rep(f, 'state.md', '| E3 | not-started |', '| E3 | discarded |'))), []);
  assert.deepEqual(run(fixture((f) => rep(f, 'state.md', '| E3 | not-started |', '| E3 | blocked (BLQ-1) |'))).filter((p) => p.code === 'bad-status'), []);
  const old = setConfig((c) => {
    c.vocab.deliverableStatuses = c.vocab.deliverableStatuses.filter((s) => s !== 'blocked' && s !== 'discarded');
  });
  assert.ok(!JSON.parse(fs.readFileSync(path.join(old, 'roadmap.config.json'), 'utf8')).vocab.deliverableStatuses.includes('blocked'));
  assert.deepEqual(run(old), []);
});

const BLQ_ROW = '| BLQ-1 | Waiting on the owner | E3 | 2026-01-03 | The owner answers |';
function withBlocker(f) {
  rep(f, 'state.md', '|---|---|---|---|---|\n<!-- /roadmap:blockers -->', `|---|---|---|---|---|\n${BLQ_ROW}\n<!-- /roadmap:blockers -->`);
}

test('r2-9 donot: absent is fine; items must cite BLQ or DEC', () => {
  const ok = fixture((f) => {
    withBlocker(f);
    f['state.md'] += '\n<!-- roadmap:donot -->\n- Do not start E3 until BLQ-1 clears.\n- Do not reopen the order (DEC-001).\n<!-- /roadmap:donot -->\n';
  });
  assert.deepEqual(run(ok), []);
  const bad = fixture((f) => (f['state.md'] += '\n<!-- roadmap:donot -->\n- Do not touch the schema.\n<!-- /roadmap:donot -->\n'));
  const p = run(bad);
  expectCode(p, 'donot-no-ref', 'error');
  assert.equal(p.filter((x) => x.code === 'donot-no-ref').length, 1);
  const unknown = fixture((f) => (f['state.md'] += '\n<!-- roadmap:donot -->\n- Do not do X (DEC-999).\n<!-- /roadmap:donot -->\n'));
  expectCode(run(unknown), 'unknown-id', 'error');
});

const REL_HEAD = '<!-- roadmap:releases -->\n| Package | Deliverables | State | Stamped SHA | Date | Environment |\n|---|---|---|---|---|---|\n';
function releasedE1(f, rel) {
  rep(f, 'state.md', '| E1 | spec | `docs/spec-e1.md` |', '| E1 | released | `4821937` |');
  f['state.md'] += `\n${REL_HEAD}${rel}\n<!-- /roadmap:releases -->\n`;
}

test('r2-9 releases: a released panel row must be listed in some package', () => {
  const none = fixture((f) => releasedE1(f, ''));
  expectCode(run(none), 'released-no-package', 'error');
  const listed = fixture((f) => releasedE1(f, '| v2026.01 | E1 | shipped | `4821937` | 2026-01-05 | prod |'));
  assert.deepEqual(run(listed), []);
  const absent = fixture((f) => rep(f, 'state.md', '| E1 | spec | `docs/spec-e1.md` |', '| E1 | released | `4821937` |'));
  assert.deepEqual(run(absent), []);
});

test('r2-9 releases: bad column count, unknown deliverable, custom releasedStatuses', () => {
  expectCode(run(fixture((f) => releasedE1(f, '| v1 | E1 | shipped |'))), 'bad-row', 'error');
  expectCode(run(fixture((f) => releasedE1(f, '| v1 | E1 E9 | shipped | `4821937` | 2026-01-05 | prod |'))), 'unknown-id', 'error');
  const custom = fixture((f) => {
    f['roadmap.config.json'] = f['roadmap.config.json'].replace('"integratedStatuses"', '"releasedStatuses": ["integrated"],\n    "integratedStatuses"');
    rep(f, 'state.md', '| E1 | spec | `docs/spec-e1.md` |', '| E1 | integrated | `4821937` |');
    f['state.md'] += `\n${REL_HEAD}| v1 | E2 | shipped | \`4821937\` | 2026-01-05 | prod |\n<!-- /roadmap:releases -->\n`;
  });
  expectCode(run(custom), 'released-no-package', 'error');
  assert.throws(() => loadRoadmap(setConfig((c) => (c.vocab.releasedStatuses = ['']))), /^Error: config: vocab\.releasedStatuses/);
});

test('r2-9 releases: Stamped SHA follows the panel SHA rules', () => {
  const bad = repoFixture((f) => releasedE1(f, '| v1 | E1 | shipped | `deadbeef1234` | 2026-01-05 | prod |'));
  const p = run(bad, createGitAdapter(bad));
  assert.ok(p.some((x) => x.code === 'sha-missing' && x.severity === 'error' && /deadbeef1234/.test(x.message)));
});

test('r2-10 fixture state.md carries the strategy version and date header line', () => {
  assert.match(fs.readFileSync(path.join(VALID, 'state.md'), 'utf8'), /^Strategy v1\.0 -- 2026-01-01$/m);
});

test('r2-12 formats.md documents every code the checker can emit', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const emitted = new Set(['config', 'internal']);
  for (const m of src.matchAll(/\badd\(\s*(?:'(?:error|warning)'|[A-Za-z]+),\s*'([a-z]+(?:-[a-z0-9]+)*)'/g)) emitted.add(m[1]);
  for (const m of src.matchAll(/code: '([a-z]+(?:-[a-z0-9]+)*)'/g)) emitted.add(m[1]);
  for (const c of ['unclosed-fence', 'malformed-anchor', 'bad-kind', 'invalid-utf8', 'git-unavailable', 'donot-no-ref', 'released-no-package', 'bad-header']) emitted.add(c);
  const formats = fs.readFileSync(path.join(here, '..', '..', 'roadmap-planner', 'references', 'formats.md'), 'utf8');
  const section = formats.slice(formats.indexOf('## 9. What the checker enforces'));
  assert.ok(emitted.size >= 35, `only ${emitted.size} codes found`);
  for (const c of emitted) assert.ok(section.includes(`\`${c}\``), `formats.md section 9 lacks ${c}`);
});

test('r2-12 bad-header is emitted for a malformed header', () => {
  const dir = tmp();
  copyRoadmapTo(dir);
  const lines = fs.readFileSync(path.join(dir, 'check-roadmap.mjs'), 'utf8').split('\n');
  lines[0] = '// check-roadmap banana';
  fs.writeFileSync(path.join(dir, 'check-roadmap.mjs'), lines.join('\n'));
  const r = spawnSync(process.execPath, [path.join(dir, 'check-roadmap.mjs'), dir], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /\[bad-header\]/);
});


// ---------- round 3 (1.3.0): cross-cutting review ----------

test('r3-1 config: blockedStatus/discardedStatus optional, non-empty, in deliverableStatuses', () => {
  assert.doesNotThrow(() => loadRoadmap(setConfig((c) => { c.vocab.blockedStatus = 'blocked'; c.vocab.discardedStatus = 'discarded'; })));
  assert.throws(() => loadRoadmap(setConfig((c) => (c.vocab.blockedStatus = 'bloqueada'))), /^Error: config: vocab\.blockedStatus/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.vocab.discardedStatus = 'descartada'))), /^Error: config: vocab\.discardedStatus/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.vocab.blockedStatus = ''))), /^Error: config: vocab\.blockedStatus/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.vocab.discardedStatus = 5))), /^Error: config: vocab\.discardedStatus/);
});

test('r3-2 config: releasedStatuses and integratedStatuses elements must be in deliverableStatuses', () => {
  assert.throws(() => loadRoadmap(setConfig((c) => (c.vocab.releasedStatuses = ['lancada']))), /^Error: config: vocab\.releasedStatuses/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.vocab.integratedStatuses = ['integrada']))), /^Error: config: vocab\.integratedStatuses/);
});

test('r3-2 vocab-default-missing: localized vocab without releasedStatuses and a releases block', () => {
  const loc = (withBlock) => fixture((f) => {
    const c = JSON.parse(f['roadmap.config.json']);
    c.vocab.deliverableStatuses = c.vocab.deliverableStatuses.map((s) => (s === 'released' ? 'lancada' : s === 'measured' ? 'medida' : s));
    c.vocab.integratedStatuses = c.vocab.integratedStatuses.map((s) => (s === 'released' ? 'lancada' : s === 'measured' ? 'medida' : s));
    f['roadmap.config.json'] = JSON.stringify(c, null, 2);
    if (withBlock) f['state.md'] += `
${REL_HEAD}
<!-- /roadmap:releases -->
`;
  });
  const p = run(loc(true));
  expectCode(p, 'vocab-default-missing', 'warning');
  assert.equal(p.filter((x) => x.severity === 'error').length, 0);
  assert.ok(!codes(run(loc(false))).includes('vocab-default-missing'));
  assert.ok(!codes(run(fixture((f) => (f['state.md'] += `
${REL_HEAD}
<!-- /roadmap:releases -->
`)))).includes('vocab-default-missing'));
});

test('r3-3 decisions.md may cite retired BLQ-n and E<n>, but not unknown DEC', () => {
  const ok = fixture((f) => (f['decisions.md'] += '\nNote: unblocks BLQ-9 and E9 (retired).\n'));
  assert.ok(!codes(run(ok)).includes('unknown-id'));
  const bad = fixture((f) => (f['decisions.md'] += '\nNote: see DEC-999.\n'));
  expectCode(run(bad), 'unknown-id', 'error');
});

test('r3-4 strategy containment message names git root only when git resolved it', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(VALID, 'roadmap.config.json'), 'utf8'));
  cfg.strategy = '../../../../../../x.md';
  assert.throws(() => validateConfig(cfg, VALID, null), /parent \(no git\)/);
  assert.throws(() => validateConfig(cfg, VALID, VALID), /repository root/);
});

// ---------- 1.5.0: verification tags, gates, limits, new warnings ----------

const tag = (kind, ev) => ` {verify: ${kind}; evidence: ${ev}}`;
// Replaces the tag on the acceptance line containing `needle` (empty string removes it).
const retag = (files, needle, newTag) => {
  const lines = files['strategy.md'].split('\n');
  const i = lines.findIndex((l) => l.includes(needle));
  assert.ok(i >= 0, 'no line with ' + needle);
  lines[i] = lines[i].replace(/ \{verify:.*\}\s*$/, '') + newTag;
  files['strategy.md'] = lines.join('\n');
};
const E1_A = 'then the item is stored and shown back.';
const E2_A = 'then the change is saved.';
const E3_A = 'then every item is listed.';
const E3_B = 'then an empty message is shown.';
const stripAllTags = (f) => { f['strategy.md'] = f['strategy.md'].replace(/ \{verify:.*\}/g, ''); };
const only = (problems, code) => problems.filter((p) => p.code === code);
const BLQ_HEAD = '| ID | Blocker | Affects | Since | Unblocks when |\n|---|---|---|---|---|\n';
const addBlocker = (files, cell) => rep(files, 'state.md', BLQ_HEAD, `${BLQ_HEAD}| BLQ-1 | Owner answer | E1 | 2026-01-01 | ${cell} |\n`);

test('v150 ac-verify-missing: no tag anywhere means no warning (adoption rule)', () => {
  assert.ok(!codes(run(fixture(stripAllTags))).includes('ac-verify-missing'));
});

test('v150 ac-verify-missing: fully tagged strategy has no warnings at all', () => {
  assert.deepEqual(run(fixture()), []);
});

test('v150 ac-verify-missing: one warning per card with untagged items once adopted', () => {
  const dir = fixture((f) => {
    retag(f, E3_A, '');
    retag(f, E3_B, '');
    retag(f, E2_A, '');
  });
  const w = only(run(dir), 'ac-verify-missing');
  assert.equal(w.length, 2);
  assert.ok(w.every((x) => x.severity === 'warning'));
  assert.ok(w.some((x) => x.message.includes('E2')) && w.some((x) => x.message.includes('E3')));
});

test('v150 ac-verify-missing: a single tag anywhere activates the rule for every card', () => {
  const dir = fixture((f) => {
    stripAllTags(f);
    retag(f, E1_A, tag('test', 'node --test'));
  });
  assert.equal(only(run(dir), 'ac-verify-missing').length, 3);
});

test('v150 ac-verify-invalid: unknown kind', () => {
  expectCode(run(fixture((f) => retag(f, E1_A, tag('magic', 'x')))), 'ac-verify-invalid', 'warning');
});

test('v150 ac-verify-invalid: blocked needs BLQ-n; with one it is valid', () => {
  expectCode(run(fixture((f) => retag(f, E1_A, ' {verify: blocked; evidence: waits}'))), 'ac-verify-invalid', 'warning');
  const good = fixture((f) => {
    retag(f, E1_A, ' {verify: blocked BLQ-1; evidence: waits for the owner}');
    addBlocker(f, 'Owner answers');
  });
  assert.deepEqual(run(good), []);
});

test('v150 ac-verify-invalid: empty evidence on executable kinds but not on human', () => {
  for (const kind of ['test', 'smoke', 'integration']) {
    expectCode(run(fixture((f) => retag(f, E1_A, ` {verify: ${kind}; evidence: }`))), 'ac-verify-invalid', 'warning');
  }
  const human = fixture((f) => retag(f, E1_A, ' {verify: human; evidence: }'));
  assert.ok(!codes(run(human)).includes('ac-verify-invalid'));
});

test('v150 ac-verify-invalid: unterminated tag', () => {
  expectCode(run(fixture((f) => {
    const lines = f['strategy.md'].split('\n');
    const i = lines.findIndex((l) => l.includes(E1_A));
    lines[i] = lines[i].replace(/\}\s*$/, '');
    f['strategy.md'] = lines.join('\n');
  })), 'ac-verify-invalid', 'warning');
});

test('v150 a tagged item still counts as one acceptance criterion', () => {
  assert.ok(!codes(run(fixture())).includes('card-acceptance'));
  const one = fixture((f) => rep(f, 'strategy.md', /2\. Given a stored item, when the user reloads.*\n/.exec(f['strategy.md'])[0], ''));
  expectCode(run(one), 'card-acceptance', 'error');
});

const GATES_RE = /<!-- roadmap:gates -->[\s\S]*?<!-- \/roadmap:gates -->\n/;
const GATES_HEAD = '<!-- roadmap:gates -->\n| ID | Command | Environment | When | Baseline |\n|---|---|---|---|---|\n';
const withGates = (rows) => fixture((f) => { f['strategy.md'] = f['strategy.md'].replace(GATES_RE, () => `${GATES_HEAD}${rows}<!-- /roadmap:gates -->\n`); });

test('v150 gate-no-command: a real command passes; empty, dash and em dash warn', () => {
  assert.deepEqual(run(withGates('| G1 | `npm test` | local | each task | green |\n')), []);
  for (const c of ['', '-', String.fromCharCode(0x2014)]) {
    const p = run(withGates(`| G1 | ${c} | local | each task | green |\n`));
    expectCode(p, 'gate-no-command', 'warning');
    assert.equal(p.filter((x) => x.severity === 'error').length, 0);
  }
});

test('v150 gates: wrong column count is a bad-row error; the block is optional', () => {
  expectCode(run(withGates('| G1 | x |\n')), 'bad-row', 'error');
  const none = fixture((f) => { f['strategy.md'] = f['strategy.md'].replace(GATES_RE, () => ''); });
  assert.deepEqual(run(none), []);
});

test('v150 pending-limit: absent means no check; over warns; at the limit is fine', () => {
  const list = (n) => Array.from({ length: n }, (_, i) => `- (owner) item ${i}`).join('\n');
  const mk = (n, limit) => fixture((f) => {
    rep(f, 'state.md', '- (owner) Confirm the storage choice.', list(n));
    const c = JSON.parse(f['roadmap.config.json']);
    if (limit === undefined) delete c.limits.pendingItems;
    else c.limits.pendingItems = limit;
    f['roadmap.config.json'] = JSON.stringify(c, null, 2);
  });
  assert.ok(!codes(run(mk(50, undefined))).includes('pending-limit'));
  expectCode(run(mk(4, 3)), 'pending-limit', 'warning');
  assert.ok(!codes(run(mk(3, 3))).includes('pending-limit'));
});

test('v150 config: limits.pendingItems must be a positive number', () => {
  assert.throws(() => loadRoadmap(setConfig((c) => (c.limits.pendingItems = 0))), /^Error: config: limits\.pendingItems/);
  assert.throws(() => loadRoadmap(setConfig((c) => (c.limits.pendingItems = '20'))), /^Error: config: limits\.pendingItems/);
});

test('v150 config: releaseBranch must be a non-empty string when present', () => {
  assert.doesNotThrow(() => loadRoadmap(setConfig((c) => (c.releaseBranch = 'release/2026-01'))));
  for (const bad of ['', '  ', 5, null, ['x']]) {
    assert.throws(() => loadRoadmap(setConfig((c) => (c.releaseBranch = bad))), /^Error: config: releaseBranch/);
  }
  assert.doesNotThrow(() => loadRoadmap(setConfig((c) => delete c.releaseBranch)));
});

test('v150 blocker-overdue: past due warns; today, future and no date do not; opts.today and default', () => {
  const at = (cell, today) => checkRoadmap(loadRoadmap(fixture((f) => addBlocker(f, cell))), okGit, today ? { today } : {});
  expectCode(at('Owner answers (due 2026-03-01)', '2026-03-02'), 'blocker-overdue', 'warning');
  assert.ok(!codes(at('Owner answers (due 2026-03-01)', '2026-03-01')).includes('blocker-overdue'));
  assert.ok(!codes(at('Owner answers (due 2026-03-01)', '2026-02-01')).includes('blocker-overdue'));
  assert.ok(!codes(at('Owner answers', '2030-01-01')).includes('blocker-overdue'));
  expectCode(at('Owner answers (due 2000-01-01)'), 'blocker-overdue', 'warning');
  assert.ok(!codes(at('Owner answers (due 2999-01-01)')).includes('blocker-overdue'));
});

test('v150 decisions-cell-long: one aggregated warning naming the first IDs, never an error', () => {
  const long = 'x'.repeat(301);
  const row = (n) => `| DEC-00${n} | 2026-01-01 | Q | ${long} | r | - | owner | - | in-force |`;
  const dir = fixture((f) => {
    const close = '<!-- /roadmap:decisions -->';
    rep(f, 'decisions.md', close, [2, 3, 4, 5, 6].map(row).join('\n') + '\n' + close);
  });
  const p = run(dir);
  const w = only(p, 'decisions-cell-long');
  assert.equal(w.length, 1);
  assert.equal(w[0].severity, 'warning');
  assert.match(w[0].message, /\b5\b/);
  assert.match(w[0].message, /DEC-002/);
  assert.ok(!codes(p).includes('cell-limit'));
  assert.ok(!codes(run(fixture())).includes('decisions-cell-long'));
});

test('v150 integrated-pending: all segments on-branch and every SHA integrated warns', () => {
  const dir = repoFixture();
  const { a, b } = withFeatCommit(dir);
  git(dir, 'merge', '-q', 'feat');
  setE1(dir, 'on-branch', `\`${b}\``);
  expectCode(run(dir, createGitAdapter(dir)), 'integrated-pending', 'warning');
  setE1(dir, 'piece 1: on-branch; piece 2: on-branch', `\`${a}\` \`${b}\``);
  expectCode(run(dir, createGitAdapter(dir)), 'integrated-pending', 'warning');
});

test('v150 integrated-pending: not merged, mixed segments, or no SHA do not fire', () => {
  const dir = repoFixture();
  const { b } = withFeatCommit(dir);
  const fires = () => codes(run(dir, createGitAdapter(dir))).includes('integrated-pending');
  setE1(dir, 'on-branch', `\`${b}\``);
  assert.equal(fires(), false);
  git(dir, 'merge', '-q', 'feat');
  setE1(dir, 'code: on-branch; acceptance: blocked', `\`${b}\``);
  assert.equal(fires(), false);
  setE1(dir, 'piece 1: on-branch; piece 2: executing', `\`${b}\``);
  assert.equal(fires(), false);
  setE1(dir, 'on-branch', '-');
  assert.equal(fires(), false);
  setE1(dir, 'on-branch', `\`${b}\``);
  assert.equal(fires(), true);
});

test('v150 integrated-pending: one SHA still off the integration branch means no warning', () => {
  const dir = repoFixture();
  const { a, b } = withFeatCommit(dir);
  setE1(dir, 'on-branch', `\`${a}\` \`${b}\``);
  assert.ok(!codes(run(dir, createGitAdapter(dir))).includes('integrated-pending'));
});

test('v150 integrated-pending: works through origin/<branch> when the local branch is behind', () => {
  const dir = repoFixture();
  const { b } = withFeatCommit(dir);
  git(dir, 'update-ref', 'refs/remotes/origin/main', b);
  setE1(dir, 'on-branch', `\`${b}\``);
  expectCode(run(dir, createGitAdapter(dir)), 'integrated-pending', 'warning');
});

test('v150 integrated-pending: skipped in a shallow clone and when no integration ref exists', () => {
  const src = repoFixture();
  fs.writeFileSync(path.join(src, 'more.txt'), 'x');
  git(src, 'add', 'more.txt');
  git(src, 'commit', '-q', '-m', 'second');
  const sha = git(src, 'rev-parse', 'HEAD');
  const dst = path.join(tmp(), 'clone');
  const c = spawnSync('git', ['clone', '-q', '--depth', '1', pathToFileURL(src).href, dst], { encoding: 'utf8' });
  assert.equal(c.status, 0, c.stderr);
  setE1(dst, 'on-branch', `\`${sha}\``);
  assert.deepEqual(codes(run(dst, createGitAdapter(dst))), ['shallow-clone']);
  const nob = repoFixture();
  git(nob, 'branch', '-m', 'main', 'other');
  setE1(nob, 'on-branch', `\`${git(nob, 'rev-parse', 'HEAD')}\``);
  const p = run(nob, createGitAdapter(nob));
  assert.ok(!codes(p).includes('integrated-pending'));
  expectCode(p, 'integration-branch-missing', 'warning');
});

test('v150 cli: the fixture with tag and gates exits 0 with no warnings', () => {
  const r = cli([VALID]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /0 error\(s\), 0 warning\(s\)/);
});

test('v150 unknown-id: ids inside the gates Command column and the verify evidence are ignored', () => {
  const f = fixture((x) => {
    rep(x, 'strategy.md', '| G1 | `node --test` |', '| G1 | `ruff check --select E501` |');
    retag(x, E1_A, tag('test', 'ruff check --select E501 src'));
  });
  assert.deepEqual(run(f), []);
});

// ---------- roadmap-format module (E2 T1) ----------

const FMT_PATH = path.join(here, '..', '..', '..', 'lib', 'roadmap-format.mjs');

test('roadmap-format module has no import, require, process, Buffer or crypto', () => {
  const src = fs.readFileSync(FMT_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(src, /^\s*import\b|\bimport\s*\(|\brequire\s*\(|\b(?:process|Buffer|crypto)\b/m);
});

test('roadmap-format parser functions match the checker', () => {
  const files = readFolder(VALID);
  for (const [text, name] of [[files['strategy.md'], 'card'], [files['strategy.md'], 'gates'], [files['state.md'], 'panel'], [files['decisions.md'], 'decisions']]) {
    assert.deepEqual(fmt.readBlocks(text, name), readBlocks(text, name), name);
  }
  const body = ['| a | b \\| c |', '|---|---|', '| 1 | 2 \\| 3 |', '```', '| x | y |', '| z | w |', '```', ''].join('\n');
  assert.deepEqual(fmt.parseTable(body), parseTable(body));
  assert.deepEqual(fmt.parseTable(body.split('```')[0]), [['1', '2 | 3']]);
  assert.deepEqual(fmt.scanFences(body, false), scanFences(body, false));
});

function readValidTexts() {
  const f = readFolder(VALID);
  return { strategy: f['strategy.md'], files: { state: f['state.md'], decisions: f['decisions.md'], log: f['log.md'], sources: f['sources.md'], requirements: f['requirements.md'], measurements: null } };
}

test('parseRoadmapTexts reads the valid fixture', () => {
  const r = fmt.parseRoadmapTexts(readValidTexts());
  assert.deepEqual(r.version, { _0: '1.0', _1: '2026-01-01' });
  assert.deepEqual(r.cards.map((c) => c.id), ['E1', 'E2', 'E3']);
  assert.deepEqual(r.cards[1].depends, ['E1']);
  assert.equal(r.cards[0].acceptance.length, 2);
  assert.ok(r.cards[0].body.includes('Definition of done'));
  assert.ok(!r.cards[0].body.includes('{verify:'));
  assert.equal(r.blocks.state.panel.rows.length, 3);
  assert.ok(r.blocks.state.panel.present && r.blocks.state.panel.closed);
  assert.deepEqual(r.blocks.state.pending.items, ['(owner) Confirm the storage choice.']);
  assert.equal(r.blocks.strategy.gates.rows[0][0], 'G1');
  assert.equal(r.blocks.strategy.phases.present, false);
  assert.deepEqual(r.blocks.measurements.measurements, { present: false, closed: false, malformed: 0, rows: [] });
});

test('parseRoadmapTexts counts malformed openers and keeps raw rows', () => {
  const t = readValidTexts();
  t.files.state = '<!-- roadmap:pending\n<!-- roadmap:panel -->\n| a | b | c |\n|---|---|---|\n| 1 | 2 | 3 |\n<!-- /roadmap:panel -->\n';
  const r = fmt.parseRoadmapTexts(t);
  assert.equal(r.blocks.state.pending.malformed, 1);
  assert.equal(r.blocks.state.pending.present, false);
  assert.deepEqual(r.blocks.state.panel.rows, [['1', '2', '3']]);
});

test('parseRoadmapTexts splits multi-id depends and reqs on commas and whitespace', () => {
  const t = readValidTexts();
  t.strategy = '<!-- roadmap:card id="E9" depends="E1 E2,E3,  Es4" reqs="REQ-1 REQ-2,\tREQ-3" -->\ncorpo\n<!-- /roadmap:card -->\n';
  const c = fmt.parseRoadmapTexts(t).cards[0];
  assert.deepEqual(c.depends, ['E1', 'E2', 'E3', 'Es4']);
  assert.deepEqual(c.reqs, ['REQ-1', 'REQ-2', 'REQ-3']);
});

// ---------- E2 T2: embed.mjs ----------

const EMBED = path.join(here, '..', '..', '..', 'scripts', 'embed.mjs');
const EMBED_TARGET = '// head\n// <embed src="src.mjs" exports="keep">\nold\n// </embed>\ntail\n';

test('embed keep copies the source with exports', () => {
  const out = embedText(EMBED_TARGET, () => 'export function f() { return 1; }\n');
  assert.match(out, /Gerado de src\.mjs por /);
  assert.ok(out.includes('export function f()'));
  assert.ok(!out.includes('old'));
  assert.ok(out.startsWith('// head'));
  assert.ok(out.endsWith('tail\n'));
});

test('embed strip removes top-level export', () => {
  const out = embedText(EMBED_TARGET.replace('keep', 'strip'), () => 'export function f() { return 1; }\nexport const k = 2;\n');
  assert.ok(out.includes('function f()'));
  assert.ok(!out.includes('export function'));
  assert.ok(!out.includes('export const'));
});

test('embed refuses impure sources', () => {
  for (const src of [
    "import fs from 'node:fs';\n",
    "const x = require('y');\n",
    'process.env.X\n',
    "Buffer.from('a')\n",
    'crypto.randomUUID()\n',
  ]) {
    assert.equal(typeof checkPureSource(src, 'bad.mjs'), 'string', src);
    assert.match(checkPureSource(src, 'bad.mjs'), /bad\.mjs/);
    assert.throws(() => embedText(EMBED_TARGET, () => src), /src\.mjs/);
  }
  assert.equal(checkPureSource('// process is a word in a comment\nexport const a = 1;\n', 'ok.mjs'), null);
});

test('embed rejects unclosed markers and bad exports', () => {
  assert.throws(() => embedText('// <embed src="a.mjs" exports="keep">\nx\n', () => ''), /a\.mjs/);
  assert.throws(() => embedText('// <embed src="a.mjs" exports="no">\n// </embed>\n', () => ''), /a\.mjs/);
});

test('the real roadmap-format module passes the purity check', () => {
  const file = path.join(here, '..', '..', '..', 'lib', 'roadmap-format.mjs');
  assert.equal(checkPureSource(fs.readFileSync(file, 'utf8'), 'roadmap-format.mjs'), null);
});

test('embed keeps CRLF and compares in LF', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'src.mjs'), 'export const a = 1;\n');
  const p = path.join(dir, 'target.mjs');
  const src = () => 'export const a = 1;\n';
  fs.writeFileSync(p, embedText(EMBED_TARGET, src).replace(/\n/g, '\r\n'));
  assert.equal(embedFile(p, { check: true }).stale, false);
  fs.writeFileSync(p, EMBED_TARGET.replace(/\n/g, '\r\n'));
  assert.equal(embedFile(p, { check: true }).stale, true);
  assert.equal(embedFile(p).stale, true);
  const final = fs.readFileSync(p, 'utf8');
  assert.ok(final.includes('\r\n'));
  assert.ok(!/[^\r]\n/.test(final));
  assert.equal(embedFile(p, { check: true }).stale, false);
});

test('embed --check exits 1 when stale and 0 when current', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'src.mjs'), 'export const a = 1;\n');
  const p = path.join(dir, 'target.mjs');
  fs.writeFileSync(p, EMBED_TARGET);
  let r = spawnSync(process.execPath, [EMBED, '--check', p], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /stale:/);
  assert.equal(fs.readFileSync(p, 'utf8'), EMBED_TARGET);
  embedFile(p);
  r = spawnSync(process.execPath, [EMBED, '--check', p], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  r = spawnSync(process.execPath, [EMBED], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('AC5: embedded parser copy is current', () => {
  const text = fs.readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n');
  const next = embedText(text, (src) => fs.readFileSync(path.resolve(here, src), 'utf8'));
  assert.equal(next, text);
  assert.ok(text.includes('// <embed src="../../../lib/roadmap-format.mjs" exports="keep">'));
});

test('parseRoadmap equals parseRoadmapTexts on the valid fixture', () => {
  const files = readFolder(VALID);
  const config = JSON.parse(files['roadmap.config.json']);
  const texts = {};
  for (const [role, name] of Object.entries(config.files)) texts[role] = name === null ? null : files[name];
  const expected = fmt.parseRoadmapTexts({ strategy: files[config.strategy], files: texts });
  assert.deepEqual(parseRoadmap(loadRoadmap(VALID)), expected);
});
