// agy-bridge.py: ponte compartilhada dos workflows Python do agy. Os testes carregam o
// arquivo por exec num dict de globais novo (como os workflows fazem) e comparam o que ele
// devolve com a fonte JS (lib/*.mjs, coordinator.js, roadmap-release.js). Sem Python >= 3.8
// as suites Python pulam com motivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '..');
const BRIDGE = path.join(HERE, 'agy-bridge.py');
const COORD_JS = path.join(PLUGIN, 'skills', 'plan-coordinator', 'workflow', 'coordinator.js');
const RELEASE_JS = path.join(PLUGIN, 'skills', 'roadmap-release', 'workflow', 'roadmap-release.js');
const SKIP_REASON = 'python >= 3.8 not found';

const lf = (s) => s.replace(/\r\n/g, '\n');
const read = (p) => lf(fs.readFileSync(p, 'utf8'));
const lib = (name) => import(pathToFileURL(path.join(PLUGIN, 'lib', name)).href);

// ---- deteccao de Python: python3, python, py -3; o atalho da Microsoft Store nao imprime versao.
function detectPython() {
  const options = [['python3', []], ['python', []], ['py', ['-3']], ['py', []]];
  for (const [cmd, pre] of options) {
    const r = spawnSync(cmd, [...pre, '-c', 'import sys; print(sys.version_info[:2])'], { encoding: 'utf8', timeout: 20000 });
    if (r.status !== 0 || typeof r.stdout !== 'string') continue;
    const m = /\((\d+),\s*(\d+)\)/.exec(r.stdout);
    if (m && (Number(m[1]) > 3 || (Number(m[1]) === 3 && Number(m[2]) >= 8))) return { cmd, pre };
  }
  return null;
}
const PY = detectPython();
const pyTest = (name, fn) => (PY ? test(name, fn) : test(name, { skip: SKIP_REASON }, fn));

// Carrega a ponte por exec num dict novo e roda o trecho `code` ali dentro; `args` chega como global.
const HARNESS = [
  'import json, sys, os',
  "p = os.environ['AGY_BRIDGE']",
  "src = open(p, encoding='utf-8').read()",
  'g = {}',
  "exec(compile(src, p, 'exec'), g)",
  "req = json.loads(sys.stdin.buffer.read().decode('utf-8'))",
  "g['args'] = req['args']",
  "exec(compile(req['code'], '<test>', 'exec'), g)",
  "sys.stdout.write(json.dumps(g.get('result'), ensure_ascii=True))",
].join('\n');

function py(code, args = {}) {
  const r = spawnSync(PY.cmd, [...PY.pre, '-I', '-X', 'utf8', '-c', HARNESS], {
    input: JSON.stringify({ code, args }),
    env: { ...process.env, AGY_BRIDGE: BRIDGE },
    encoding: 'utf8',
    timeout: 120000,
  });
  if (r.status !== 0) throw new Error(`python exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function git(cwd, ...a) {
  return execFileSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { encoding: 'utf8' }).trim();
}

// ---- estaticos (sem Python)
test('AC7: agy-bridge.py exists, is stdlib only and never uses a shell string', () => {
  assert.ok(fs.existsSync(BRIDGE), 'scripts/agy-bridge.py must exist');
  const src = read(BRIDGE);
  assert.ok(!/shell\s*=\s*True/.test(src), 'no shell=True');
  assert.ok(!/cmd\.exe/i.test(src), 'no cmd.exe');
  const stdlib = new Set(['os', 'sys', 're', 'json', 'ntpath', 'posixpath', 'shutil', 'subprocess', 'tempfile', 'pathlib', 'typing', '__future__']);
  for (const m of src.matchAll(/^\s*(?:import|from)\s+([A-Za-z_][\w]*)/gm)) {
    assert.ok(stdlib.has(m[1]), `non-stdlib import: ${m[1]}`);
  }
});

test('AC7: agy-bridge.py basename is unique in the plugin', () => {
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'agy-bridge.py') found.push(p);
    }
  };
  walk(PLUGIN);
  assert.equal(found.length, 1);
});

// ---- carregamento
pyTest('AC7: the bridge loads by exec into a fresh globals dict and exposes the contract', () => {
  const names = py(`result = sorted(n for n, v in globals().items() if callable(v) and not n.startswith('_'))`);
  for (const n of ['plugin_root_from', 'run_cli', 'find_git_bash', 'run_shell', 'call_lib', 'load_agent_body', 'with_tool_note', 'load_js_schemas', 'load_test_integrity', 'run_test_integrity', 'git_snapshot']) {
    assert.ok(names.includes(n), `missing ${n}`);
  }
});

pyTest('AC7: plugin_root_from follows pluginRootOf (backslashes, required suffix)', () => {
  const r = py(
    `s = '/skills/roadmap-tracker/scripts/roadmap.mjs'
result = [plugin_root_from(args['a'], s), plugin_root_from(args['b'], s), plugin_root_from(args['c'], s),
          plugin_root_from('/x/skills/plan-coordinator/scripts/progress.mjs', '/skills/plan-coordinator/scripts/progress.mjs')]`,
    { a: 'C:\\p\\plugin\\skills\\roadmap-tracker\\scripts\\roadmap.mjs', b: '/p/plugin/skills/roadmap-tracker/scripts/roadmap.mjs', c: '/p/plugin/scripts/roadmap.mjs' },
  );
  assert.deepEqual(r, ['C:/p/plugin', '/p/plugin', null, '/x']);
});

// ---- run_cli
pyTest('AC7: run_cli returns exit, stdout and stderr without a shell', () => {
  const r = py(
    `echo = run_cli(['node', '-e', 'process.stdin.pipe(process.stdout)'], input=args['text'])
bad = run_cli(['node', '-e', 'console.error("oops"); process.exit(3)'])
cwd = run_cli(['node', '-e', 'process.stdout.write(process.cwd())'], cwd=args['cwd'])
missing = run_cli(['definitely-not-a-command-agy'])
result = [echo, bad, cwd, missing['exit'] != 0]`,
    { text: 'Adoção/portão — café', cwd: os.tmpdir() },
  );
  assert.deepEqual(r[0], { exit: 0, stdout: 'Adoção/portão — café', stderr: '' });
  assert.equal(r[1].exit, 3);
  assert.match(r[1].stderr, /oops/);
  assert.equal(fs.realpathSync(r[2].stdout), fs.realpathSync(os.tmpdir()));
  assert.equal(r[3], true);
});

// ---- find_git_bash / run_shell (C5)
pyTest('C5: find_git_bash never returns a path under SystemRoot and prefers the Git Bash', () => {
  const root = tmp('agy-bash-');
  try {
    const sys32 = path.join(root, 'Windows', 'System32', 'bash.exe');
    const gitBash = path.join(root, 'Git', 'bin', 'bash.exe');
    for (const f of [sys32, gitBash]) {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, '');
    }
    const env = { SystemRoot: path.join(root, 'Windows') };
    const r = py(
      `a = find_git_bash(env=args['env'], candidates=[args['sys32'], args['git']])
b = find_git_bash(env=args['env'], candidates=[args['sys32']])
c = find_git_bash(env=args['env'], candidates=[args['sys32'].replace(chr(92), '/').upper().replace(args['root'].replace(chr(92), '/').upper(), args['root'].replace(chr(92), '/'))])
d = find_git_bash(env=args['env'], candidates=[args['sys32'], args['missing'], args['git']])
result = [a, b, c, d]`,
      { env, sys32, git: gitBash, root, missing: path.join(root, 'nope', 'bash.exe') },
    );
    assert.equal(r[0], gitBash);
    assert.equal(r[1], null);
    assert.equal(r[2], null);
    assert.equal(r[3], gitBash);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

pyTest('C5: run_shell throws git-bash-not-found without a valid bash and runs [bash, -lc, cmd] otherwise', () => {
  const root = tmp('agy-shell-');
  try {
    const sys32 = path.join(root, 'Windows', 'System32', 'bash.exe');
    const gitBash = path.join(root, 'Git', 'bin', 'bash.exe');
    for (const f of [sys32, gitBash]) {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, '');
    }
    const env = { SystemRoot: path.join(root, 'Windows') };
    const r = py(
      `try:
    run_shell('echo hi', None, env=args['env'], candidates=[args['sys32']])
    thrown = 'no-raise'
except RuntimeError as e:
    thrown = str(e)
seen = []
def fake(argv, cwd=None, input=None, timeout=None):
    seen.append([argv, cwd])
    return {'exit': 0, 'stdout': 'ok', 'stderr': ''}
run_cli = fake
out = run_shell('echo hi', args['root'], env=args['env'], candidates=[args['sys32'], args['git']])
result = [thrown, seen, out]`,
      { env, sys32, git: gitBash, root },
    );
    assert.match(r[0], /git-bash-not-found/);
    assert.deepEqual(r[1], [[[gitBash, '-lc', 'echo hi'], root]]);
    assert.equal(r[2].stdout, 'ok');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

pyTest('C5: on this machine find_git_bash is outside SystemRoot (Windows) or /bin/bash', () => {
  const r = py(`result = {'bash': find_git_bash(), 'err': None}
try:
    result['sh'] = run_shell('echo agy-ok')['stdout'].strip()
except RuntimeError as e:
    result['err'] = str(e)`);
  if (process.platform === 'win32') {
    const sysRoot = path.normalize(process.env.SystemRoot || 'C:\\Windows').toLowerCase() + path.sep;
    if (r.bash === null) {
      assert.match(r.err, /git-bash-not-found/);
    } else {
      assert.ok(!path.normalize(r.bash).toLowerCase().startsWith(sysRoot), `under SystemRoot: ${r.bash}`);
      assert.match(r.bash, /bash\.exe$/i);
      assert.equal(r.sh, 'agy-ok');
    }
  } else if (fs.existsSync('/bin/bash')) {
    assert.equal(r.bash, '/bin/bash');
    assert.equal(r.sh, 'agy-ok');
  }
});

// ---- call_lib
pyTest('AC7: call_lib fnv1a and canon match lib/plan-digest.mjs on accented text', async () => {
  const { fnv1a, canon, planDigest } = await lib('plan-digest.mjs');
  const texts = ['Adoção/portão — café', 'emoji 😀 ünï', ''];
  const value = { b: 1, a: { d: [2, { z: 'é', y: 2 }], c: null }, 'ç': true };
  const plan = { schema: 'plan/1', tasks: [{ n: 1, title: 'Adoção' }] };
  const r = py(
    `result = {
  'h': [call_lib(args['root'], 'fnv1a(p)', t) for t in args['texts']],
  'c': call_lib(args['root'], 'canon(p)', args['value']),
  'd': call_lib(args['root'], 'planDigest(p)', {'plan': args['plan'], 'source': 'x'}),
}`,
    { root: PLUGIN, texts, value, plan },
  );
  assert.deepEqual(r.h, texts.map(fnv1a));
  assert.equal(JSON.stringify(r.c), JSON.stringify(canon(value)));
  assert.equal(r.d, planDigest({ plan, source: 'x' }));
});

pyTest('AC7: call_lib toAgyRoute(route(...)) of vector 5 equals the lib result', async () => {
  const { route } = await lib('routing.mjs');
  const { toAgyRoute, nextAgyTier } = await lib('agy-routing.mjs');
  const table = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'plan-tool', 'routing-table.json'), 'utf8'));
  const input = table.rows[4].input;
  const task = {
    score: { ambiguity: input.ambiguity, reasoning: input.reasoning, blast: input.blast, verifiability: input.verifiability },
    files: { create: Array.from({ length: input.fileCount }, (_, i) => `f${i + 1}`), modify: [], test: [] },
    external: input.external,
  };
  const ctx = { hasDependents: input.hasDependents };
  const expected = toAgyRoute(route(task, ctx));
  const r = py(
    `result = [call_lib(args['root'], 'toAgyRoute(route(p.task, p.ctx))', {'task': args['task'], 'ctx': args['ctx']}),
          call_lib(args['root'], 'nextAgyTier(p[0], p[1])', ['pro', True]),
          call_lib(args['root'], 'nextAgyTier(p[0], p[1])', ['flash_lite', True])]`,
    { root: PLUGIN, task, ctx },
  );
  assert.deepEqual(r[0], expected);
  assert.equal(r[0].agyModel, 'pro');
  assert.equal(r[1], nextAgyTier('pro', true));
  assert.equal(r[1], null);
  assert.equal(r[2], 'flash');
});

pyTest('AC7: call_lib raises with the Node stderr on a failing expression', () => {
  const r = py(`try:
    call_lib(args['root'], 'thisFunctionDoesNotExist(p)', 1)
    result = 'no-raise'
except Exception as e:
    result = str(e)`, { root: PLUGIN });
  assert.match(r, /thisFunctionDoesNotExist/);
});

// ---- agent body
pyTest('AC7: load_agent_body returns the agent body without the frontmatter', () => {
  const r = py(`result = load_agent_body(args['root'], 'implementer')`, { root: PLUGIN });
  const text = read(path.join(PLUGIN, 'agents', 'implementer.md'));
  const m = /^---\n[\s\S]*?\n---\n?([\s\S]*)$/.exec(text);
  assert.equal(r, m[1]);
  assert.ok(!r.startsWith('---'));
});

// ---- nota de ferramentas do agy
const AGENTS_DIR = path.join(PLUGIN, 'agents');
const agentFiles = () => fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md')).sort();

pyTest('E52 AC1: with_tool_note keeps the agent body first, then the note, then the prompt, for the seven agents', () => {
  const names = agentFiles().map((f) => f.slice(0, -'.md'.length));
  assert.equal(names.length, 7, names.join(', '));
  const r = py(
    `result = {'note': AGY_TOOL_NOTE, 'agents': []}
for n in args['names']:
    body = load_agent_body(args['root'], n)
    result['agents'].append({'name': n, 'body': body, 'text': with_tool_note(body, 'PROMPT')})`,
    { root: PLUGIN, names },
  );
  assert.deepEqual(r.agents.map((a) => a.name), names);
  for (const a of r.agents) {
    assert.ok(a.body.length > 0, `${a.name}: empty body`);
    assert.ok(a.text.startsWith(a.body), `${a.name}: the text does not start with the body`);
    assert.ok(a.text.indexOf(r.note, a.body.length) >= a.body.length, `${a.name}: no note after the body`);
    assert.ok(a.text.endsWith('PROMPT'), `${a.name}: the text does not end with the prompt`);
    assert.equal(a.text, `${a.body}\n\n${r.note}\n\nPROMPT`, a.name);
  }
});

pyTest('E52 AC1: AGY_TOOL_NOTE names the agy tools', () => {
  const note = py(`result = AGY_TOOL_NOTE`);
  for (const t of ['read_file', 'StartLine', 'EndLine', 'write_file', 'edit_file', 'run_command', 'pwsh', 'search_web']) {
    assert.ok(note.includes(t), `the note lacks ${t}`);
  }
  assert.ok(note.length <= 600, `note has ${note.length} characters`);
  assert.ok(!note.includes('\n'), 'the note is a single line');
  for (const t of ['subagent_type', 'System32', "'haiku'", "'sonnet'", "'opus'", 'Do not spawn subagents']) {
    assert.ok(!note.includes(t), `the note must not contain ${t}`);
  }
});

test('E52 AC1: agents stay free of the note and both workflows call with_tool_note in call_agent', () => {
  for (const f of agentFiles()) {
    const text = read(path.join(AGENTS_DIR, f));
    assert.ok(!text.includes('read_file'), `${f} mentions read_file`);
    assert.ok(!text.includes('AGY_TOOL_NOTE'), `${f} mentions AGY_TOOL_NOTE`);
  }
  const workflows = [
    path.join(PLUGIN, 'skills', 'roadmap-release', 'workflow', 'roadmap-release-agy.py'),
    path.join(PLUGIN, 'skills', 'plan-coordinator', 'workflow', 'coordinator-agy.py'),
  ];
  for (const file of workflows) {
    const src = read(file);
    const name = path.basename(file);
    const start = src.indexOf('async def call_agent(');
    assert.ok(start >= 0, `${name}: no call_agent`);
    // a funcao vai ate a proxima linha sem indentacao depois da assinatura
    const [signature, ...lines] = src.slice(start).split('\n');
    const end = lines.findIndex((l) => /^\S/.test(l));
    const fn = [signature, ...(end < 0 ? lines : lines.slice(0, end))].join('\n');
    assert.ok(fn.includes('with_tool_note('), `${name}: call_agent does not call with_tool_note`);
    assert.ok(!src.includes(String.raw`body + '\n\n' + prompt`), `${name}: still joins body and prompt directly`);
    assert.ok(!src.includes(String.raw`BODIES[role] + '\n\n' + prompt`), `${name}: still joins BODIES[role] and prompt directly`);
  }
});

// ---- schemas
// Recorte independente do bridge: da linha de secao `schemas` ate o proximo `// ---`.
function jsSchemas(file) {
  const lines = read(file).split('\n');
  const start = lines.findIndex((l) => /^\/\/ -{3,} schemas\b/.test(l));
  assert.ok(start >= 0, 'schemas section marker');
  let end = lines.findIndex((l, i) => i > start && /^\/\/ -{3,}/.test(l));
  if (end < 0) end = lines.length;
  const slice = lines.slice(start + 1, end).join('\n');
  const names = [...slice.matchAll(/^const (S_\w+)\s*=/gm)].map((m) => m[1]);
  const out = new Function(`${slice}; return {${names.join(', ')}}`)();
  return JSON.parse(JSON.stringify(out));
}

pyTest('AC7: load_js_schemas of coordinator.js is identical to the JS source', () => {
  const r = py(`result = load_js_schemas(args['js'])`, { js: COORD_JS });
  for (const n of ['S_REVIEW', 'S_TASKREVIEW', 'S_CHECKS', 'S_IMPL']) {
    assert.ok(r[n], `missing ${n}`);
    assert.ok(r[n].type, `${n} has type`);
  }
  assert.deepEqual(r, jsSchemas(COORD_JS));
});

pyTest('AC7: load_js_schemas of roadmap-release.js is identical to the JS source', () => {
  const r = py(`result = load_js_schemas(args['js'])`, { js: RELEASE_JS });
  for (const n of ['S_IMPL', 'S_TASKREVIEW', 'S_PLANREVIEW', 'S_SPEC', 'S_MERGE', 'S_INTEG', 'S_ROLLBACK']) {
    assert.ok(r[n], `missing ${n}`);
    assert.ok(r[n].type, `${n} has type`);
  }
  assert.deepEqual(r, jsSchemas(RELEASE_JS));
});

pyTest('AC7: load_js_schemas fails without the schemas marker', () => {
  const root = tmp('agy-js-');
  try {
    const f = path.join(root, 'x.js');
    fs.writeFileSync(f, 'const S_A = { type: "object" }\n');
    const r = py(`try:
    load_js_schemas(args['js'])
    result = 'no-raise'
except Exception as e:
    result = 'raised'`, { js: f });
    assert.equal(r, 'raised');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---- test-integrity
function jsIntegrity() {
  const m = /const TEST_INTEGRITY_DEFAULT = String\.raw`([^`]*)`/.exec(read(RELEASE_JS));
  assert.ok(m, 'TEST_INTEGRITY_DEFAULT');
  return m[1];
}

pyTest('AC7: load_test_integrity is the exact String.raw text of roadmap-release.js', () => {
  const expected = jsIntegrity();
  const r = py(
    `result = [load_test_integrity(args['js'], {}), load_test_integrity(args['js'], None),
          load_test_integrity(args['js'], {'testIntegrity': False}),
          load_test_integrity(args['js'], {'testIntegrity': 'console.log(1)'}),
          load_test_integrity(args['js'], {'testIntegrity': '   '}),
          load_test_integrity(args['js'], {'testIntegrity': True})]`,
    { js: RELEASE_JS },
  );
  assert.equal(r[0], expected);
  assert.equal(r[1], expected);
  assert.equal(r[2], null);
  assert.equal(r[3], 'console.log(1)');
  assert.equal(r[4], expected);
  assert.equal(r[5], expected);
  assert.ok(!r[0].includes('${'));
  assert.match(r[0].split('\n').pop(), /^console\.log\(JSON\.stringify\(\{ deletedTests, .*\}\)\)$/);
});

pyTest('AC7: load_test_integrity fails when the template has an interpolation', () => {
  const root = tmp('agy-ti-');
  try {
    const f = path.join(root, 'x.js');
    fs.writeFileSync(f, 'const TEST_INTEGRITY_DEFAULT = String.raw`console.log(${1})`\n');
    const r = py(`try:
    load_test_integrity(args['js'], {})
    result = 'no-raise'
except Exception as e:
    result = 'raised'`, { js: f });
    assert.equal(r, 'raised');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function makeRepo(prefix) {
  const dir = tmp(prefix);
  git(dir, 'init', '-q');
  return dir;
}

pyTest('AC7: run_test_integrity counts a removed assert in a temporary repo', () => {
  const dir = makeRepo('agy-integ-');
  try {
    fs.writeFileSync(path.join(dir, 'a.test.js'), "assert.equal(1, 1)\nassert.equal(2, 2)\nconsole.log('x')\n");
    fs.writeFileSync(path.join(dir, 'a.js'), 'module.exports = 1\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'base');
    const base = git(dir, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(dir, 'a.test.js'), "assert.equal(1, 1)\nconsole.log('x')\n");
    fs.writeFileSync(path.join(dir, 'a.js'), 'module.exports = 2\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'drop an assert');
    const r = py(
      `prog = load_test_integrity(args['js'], {})
result = [run_test_integrity(prog, args['wt'], args['base']), run_test_integrity(prog, args['wt'], 'no-such-ref'), run_test_integrity(prog, args['nowt'], args['base'])]`,
      { js: RELEASE_JS, wt: dir, base, nowt: path.join(dir, 'missing-dir') },
    );
    assert.ok(r[0].removedAsserts >= 1, JSON.stringify(r[0]));
    assert.deepEqual(r[0].deletedTests, []);
    assert.equal(r[0].prodChanged, 1);
    assert.equal(r[0].assertsAdded, 0);
    assert.equal(r[0].skipsAdded, 0);
    const unmeasured = { deletedTests: [], removedAsserts: -1, skipsAdded: 0, prodChanged: 0, assertsAdded: 0 };
    assert.deepEqual(r[1], unmeasured);
    assert.deepEqual(r[2], unmeasured);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- git_snapshot
pyTest('AC7: git_snapshot changes when a file is touched and when HEAD moves', () => {
  const dir = makeRepo('agy-snap-');
  try {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'one');
    const head = git(dir, 'rev-parse', 'HEAD');
    const s1 = py(`result = git_snapshot(args['wt'])`, { wt: dir });
    assert.deepEqual(s1, [head, '']);
    fs.writeFileSync(path.join(dir, 'a.txt'), 'two\n');
    const s2 = py(`result = git_snapshot(args['wt'])`, { wt: dir });
    assert.equal(s2[0], head);
    assert.match(s2[1], /a\.txt/);
    assert.notDeepEqual(s2, s1);
    git(dir, 'commit', '-q', '-am', 'two');
    const s3 = py(`result = git_snapshot(args['wt'])`, { wt: dir });
    assert.notEqual(s3[0], head);
    assert.equal(s3[1], '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
