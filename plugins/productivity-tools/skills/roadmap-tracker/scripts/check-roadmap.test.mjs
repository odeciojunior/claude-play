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
  checkRoadmap,
  createGitAdapter,
  compareVersions,
  findNewerPluginCopy,
} from './check-roadmap.mjs';

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
  assert.equal(first, '// check-roadmap 1.2.0 format 1');
  assert.equal(FORMAT_VERSION, 1);
  assert.equal(CHECKER_VERSION, '1.2.0');
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
    run(fixture((f) => rep(f, 'strategy.md', '2. Given no items, when the user opens the report, then an empty message is shown.\n', ''))),
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

test('git: sha-missing in log evidence', () => {
  const dir = repoFixture((f) => rep(f, 'log.md', '| `strategy.md` |', '| `deadbeef1234` |'));
  expectCode(run(dir, createGitAdapter(dir)), 'sha-missing', 'error');
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
  assert.equal(r.stdout.trim(), '1.2.0 format 1');
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
  const r = cli([VALID], { env: { ROADMAP_CHECK_PLUGIN_CACHE: cacheWith('1.3.0') } });
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.stdout.split('checker-stale').length - 1, 1);
  assert.match(r.stdout, /1\.3\.0/);
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
  assert.equal(spawnSync(process.execPath, [path.join(dir, 'check-roadmap.mjs'), '--version'], { encoding: 'utf8' }).stdout.trim(), '1.2.0 format 1');
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
